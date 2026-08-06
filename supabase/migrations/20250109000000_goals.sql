-- ---------------------------------------------------------------------------
-- 0009 · Goals
-- ---------------------------------------------------------------------------
-- A goal is a scope, a target date, and a baseline.
--
-- The baseline is the part most implementations get wrong. If someone already
-- knows half a juz' when they set a goal for it, the required pace must be
-- computed over what remains, not over the whole scope — otherwise the app
-- reports a pace they have already partly achieved and the number is useless.
--
-- Projection uses recent actual pace rather than the plan's stated pace. A
-- goal that reports "on track" because the plan says four pages a day, while
-- the person has recorded nothing for three weeks, is worse than no goal.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- goal_scope_range
-- ---------------------------------------------------------------------------
-- Resolves a scope description to a range over the canonical ayah index, so
-- that goals compose with everything else rather than introducing a second way
-- of describing a portion of the Quran.
-- ---------------------------------------------------------------------------
create or replace function public.goal_scope_range(
  p_scope_type text,
  p_scope_from integer,
  p_scope_to   integer default null,
  p_edition_id smallint default 1
)
returns int4range
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_range int4range;
begin
  case p_scope_type
    when 'quran' then
      v_range := int4range(1, 6236, '[]');

    when 'juz' then
      if p_scope_from is null or p_scope_from not between 1 and 30 then
        raise exception 'juz must be between 1 and 30' using errcode = '22003';
      end if;
      select int4range(min(id), max(id), '[]') into v_range
        from public.ayahs
       where juz between p_scope_from and coalesce(p_scope_to, p_scope_from);

    when 'surah' then
      if p_scope_from is null or p_scope_from not between 1 and 114 then
        raise exception 'surah must be between 1 and 114' using errcode = '22003';
      end if;
      select int4range(min(first_ayah_id), max(last_ayah_id), '[]') into v_range
        from public.surahs
       where number between p_scope_from and coalesce(p_scope_to, p_scope_from);

    when 'pages' then
      select int4range(min(lower(ayah_range)), max(upper(ayah_range) - 1), '[]')
        into v_range
        from public.mushaf_pages
       where edition_id = p_edition_id
         and page_number between p_scope_from
                             and coalesce(p_scope_to, p_scope_from);

    when 'ayahs' then
      v_range := int4range(p_scope_from, coalesce(p_scope_to, p_scope_from), '[]');

    else
      raise exception 'unknown scope type %', p_scope_type using errcode = '22023';
  end case;

  if v_range is null or isempty(v_range) then
    raise exception 'that scope resolves to nothing' using errcode = '22023';
  end if;

  return v_range;
end;
$$;

comment on function public.goal_scope_range is
  'Resolves a goal scope to a range over the canonical ayah index.';

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create table public.goals (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users (id) on delete cascade,
  name            text        not null,
  scope_type      text        not null,
  scope_from      integer,
  scope_to        integer,
  ayah_range      int4range   not null,
  started_on      date        not null default current_date,
  target_date     date        not null,
  -- Ayahs of the scope already memorised when the goal was created. Frozen at
  -- creation: recomputing it later would let progress silently reset.
  baseline_ayahs  integer     not null default 0,
  status          text        not null default 'active',
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint goals_name_length
    check (char_length(btrim(name)) between 1 and 80),
  constraint goals_scope_type
    check (scope_type in ('quran', 'juz', 'surah', 'pages', 'ayahs')),
  constraint goals_status
    check (status in ('active', 'completed', 'abandoned')),
  constraint goals_range_bounded
    check (lower(ayah_range) >= 1 and upper(ayah_range) <= 6237),
  constraint goals_range_nonempty check (not isempty(ayah_range)),
  constraint goals_baseline_nonnegative check (baseline_ayahs >= 0),
  constraint goals_target_after_start check (target_date >= started_on),
  constraint goals_completed_consistent
    check (
      (status = 'completed' and completed_at is not null)
      or (status <> 'completed' and completed_at is null)
    )
);

comment on table public.goals is
  'Memorisation targets. Scope is stored as an ayah range so goals compose with everything else.';
comment on column public.goals.baseline_ayahs is
  'Scope already memorised at creation. Frozen, so required pace is computed over what actually remains.';

create index goals_user_active_idx
  on public.goals (user_id, target_date)
  where deleted_at is null and status = 'active';

create index goals_range_idx
  on public.goals using gist (user_id, ayah_range)
  where deleted_at is null;

create trigger goals_set_updated_at
  before update on public.goals
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- v_goal_progress
-- ---------------------------------------------------------------------------
-- Everything needed to report on a goal honestly.
--
-- Two rates are computed. `required_ayahs_per_day` is what the remaining time
-- demands from here. `recent_ayahs_per_day` is what has actually been happening
-- over the last fortnight — that is what the projection uses, because the rate
-- someone intended is not evidence of anything.
-- ---------------------------------------------------------------------------
create view public.v_goal_progress
with (security_invoker = true) as
with scope as (
  select
    g.*,
    public.ayah_range_length(g.ayah_range) as scope_ayahs,
    (
      select count(*)::integer
        from public.v_memorised_ayahs m
       where m.user_id = g.user_id
         and m.ayah_id <@ g.ayah_range
    ) as memorised_ayahs,
    (
      select count(*)::integer
        from public.mushaf_pages p
       where p.ayah_range <@ g.ayah_range
         and p.edition_id = 1
    ) as scope_pages
  from public.goals g
  where g.deleted_at is null
),
recent as (
  select
    s.id as goal_id,
    coalesce(sum(
      public.ayah_range_length(ms.ayah_range * s.ayah_range)
    ), 0)::integer as recent_ayahs
  from scope s
  left join public.memorisation_segments ms
    on ms.user_id = s.user_id
   and ms.deleted_at is null
   and ms.status = 'memorised'
   and ms.ayah_range && s.ayah_range
   and ms.memorised_on >= current_date - 13
  group by s.id
)
select
  s.id,
  s.user_id,
  s.name,
  s.scope_type,
  s.scope_from,
  s.scope_to,
  s.ayah_range,
  s.started_on,
  s.target_date,
  s.status,
  s.completed_at,
  s.scope_ayahs,
  s.scope_pages,
  s.baseline_ayahs,
  s.memorised_ayahs,
  greatest(0, s.scope_ayahs - s.memorised_ayahs) as remaining_ayahs,

  round(s.memorised_ayahs::numeric * 100 / nullif(s.scope_ayahs, 0), 1)
    as percent_complete,

  (s.target_date - s.started_on) as days_total,
  greatest(0, current_date - s.started_on) as days_elapsed,
  (s.target_date - current_date) as days_remaining,

  -- What the time left demands. Null once the target date has passed, because
  -- a rate over zero or negative days is not a number worth showing.
  case
    when s.target_date <= current_date then null
    else round(
      greatest(0, s.scope_ayahs - s.memorised_ayahs)::numeric
      / (s.target_date - current_date), 1
    )
  end as required_ayahs_per_day,

  -- What is actually happening, over a fortnight. Short enough to react to a
  -- stall, long enough not to panic over a single quiet day.
  round(r.recent_ayahs::numeric / 14, 1) as recent_ayahs_per_day,

  -- Pace since the goal began, for context rather than projection.
  case
    when current_date <= s.started_on then null
    else round(
      greatest(0, s.memorised_ayahs - s.baseline_ayahs)::numeric
      / (current_date - s.started_on), 1
    )
  end as average_ayahs_per_day,

  -- Projection from observed pace. Null when nothing is happening, which is
  -- the honest answer: at zero pace there is no completion date.
  case
    when s.memorised_ayahs >= s.scope_ayahs then current_date
    when r.recent_ayahs <= 0 then null
    else current_date + ceil(
      (s.scope_ayahs - s.memorised_ayahs)::numeric / (r.recent_ayahs::numeric / 14)
    )::integer
  end as projected_completion_date,

  case
    when s.status = 'completed' or s.memorised_ayahs >= s.scope_ayahs then 'complete'
    when s.status = 'abandoned' then 'abandoned'
    when s.target_date < current_date then 'overdue'
    when r.recent_ayahs <= 0 then 'stalled'
    when (s.scope_ayahs - s.memorised_ayahs)::numeric
         / nullif(r.recent_ayahs::numeric / 14, 0)
         <= (s.target_date - current_date) then 'on_track'
    else 'behind'
  end as state
from scope s
join recent r on r.goal_id = s.id;

comment on view public.v_goal_progress is
  'Goal progress with required and observed pace. Projection uses observed pace, not the plan.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.goals enable row level security;

create policy "goals_select_own" on public.goals
  for select to authenticated using (user_id = (select auth.uid()));

create policy "goals_insert_own" on public.goals
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "goals_update_own" on public.goals
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Column privileges
-- ---------------------------------------------------------------------------
-- Table-level UPDATE must be revoked before column grants mean anything.
-- `revoke update (col)` against a role that holds table-level UPDATE is a
-- silent no-op: the broad privilege still applies and the narrow revoke has
-- nothing to act on. Revoking the table privilege and granting back only the
-- writable columns is the form that actually holds.
--
-- baseline_ayahs and started_on are excluded deliberately: both are frozen at
-- creation, and letting either be rewritten would silently reset progress.
-- ---------------------------------------------------------------------------
revoke update on public.goals from authenticated;
grant update (
  name, scope_type, scope_from, scope_to, ayah_range,
  target_date, status, completed_at, deleted_at
) on public.goals to authenticated;
