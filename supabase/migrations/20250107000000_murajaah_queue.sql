-- ---------------------------------------------------------------------------
-- 0007 · Murajaah — the daily queue
-- ---------------------------------------------------------------------------
-- The queue is persisted rather than computed on every request. Three reasons:
--
--   1. Stability. If the queue were derived from the rotation cursor, then
--      completing an item would shift the rest of the day's list underneath the
--      user. A plan that rearranges itself while you work through it is not a
--      plan.
--   2. Overdue. Uncompleted items from previous days are only knowable if those
--      days were written down.
--   3. History. What was scheduled is as interesting as what was done.
--
-- Generation is idempotent, so opening the app repeatedly on the same day
-- returns the same queue.
-- ---------------------------------------------------------------------------

create table public.review_queues (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  queue_date   date        not null,
  is_rest_day  boolean     not null default false,
  page_budget  smallint    not null default 0,
  generated_at timestamptz not null default now(),

  constraint review_queues_one_per_day unique (user_id, queue_date),
  constraint review_queues_budget_sane check (page_budget between 0 and 604)
);

comment on table public.review_queues is
  'One murajaah plan per user per day. Generated once, then stable.';

create index review_queues_user_date_idx
  on public.review_queues (user_id, queue_date desc);

create table public.review_queue_items (
  id           uuid        primary key default gen_random_uuid(),
  queue_id     uuid        not null references public.review_queues (id) on delete cascade,
  page_number  smallint    not null,
  tier         text        not null,
  position     smallint    not null,
  completed_at timestamptz,
  confidence   smallint,
  session_id   uuid        references public.review_sessions (id) on delete set null,

  constraint review_queue_items_tier
    check (tier in ('sabqi', 'manzil', 'weak')),
  constraint review_queue_items_page_range
    check (page_number between 1 and 604),
  constraint review_queue_items_confidence_range
    check (confidence is null or confidence between 1 and 5),
  -- A completed item must record how it went, and an incomplete one must not
  -- pretend to. Keeping these in step prevents a half-written completion.
  constraint review_queue_items_completion_consistent
    check (
      (completed_at is null and confidence is null)
      or (completed_at is not null and confidence is not null)
    ),

  unique (queue_id, page_number),
  unique (queue_id, position)
);

comment on table public.review_queue_items is
  'Individual pages scheduled for a given day, in the order they should be recited.';

create index review_queue_items_queue_idx
  on public.review_queue_items (queue_id, position);

create index review_queue_items_outstanding_idx
  on public.review_queue_items (queue_id)
  where completed_at is null;

-- ---------------------------------------------------------------------------
-- ensure_review_queue
-- ---------------------------------------------------------------------------
-- Builds the queue for a date if it does not exist, and returns its id either
-- way. The allocation order is the scheduling policy:
--
--   1. Weak pages, capped at a third of the budget. Without the cap, a user
--      with fifty weak pages would see nothing but weak pages every day and
--      the rotation would never advance — the schedule would quietly stop
--      being a schedule.
--   2. Sabqi, up to its own allocation. Recent material needs frequent contact
--      or it decays faster than the long rotation can catch.
--   3. Manzil fills whatever remains, taken contiguously from the cursor so
--      the day's pages can actually be recited in sequence.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_review_queue(
  p_date date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_plan     public.review_plans%rowtype;
  v_queue_id uuid;
  v_budget   integer;
  v_weak_cap integer;
  v_taken    integer := 0;
  v_added    integer;
  v_is_rest  boolean;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_plan from public.review_plans where user_id = v_caller;
  if not found then
    return null;
  end if;

  select id into v_queue_id
    from public.review_queues
   where user_id = v_caller and queue_date = p_date;

  if v_queue_id is not null then
    return v_queue_id;
  end if;

  v_is_rest := extract(dow from p_date)::smallint = any (v_plan.rest_days);
  v_budget := case
    when v_is_rest then 0
    else public.effective_daily_pages(v_plan.id)
  end;

  insert into public.review_queues (user_id, queue_date, is_rest_day, page_budget)
  values (v_caller, p_date, v_is_rest, v_budget)
  returning id into v_queue_id;

  if v_is_rest or v_budget <= 0 then
    return v_queue_id;
  end if;

  v_weak_cap := case
    when v_plan.include_weak then greatest(1, floor(v_budget / 3.0)::integer)
    else 0
  end;

  -- 1. Weak pages, longest neglected first.
  if v_weak_cap > 0 then
    insert into public.review_queue_items (queue_id, page_number, tier, position)
    select v_queue_id, ranked.page_number, 'weak', ranked.rn
    from (
      select
        s.page_number,
        row_number() over (
          order by s.last_reviewed_on asc nulls first, s.page_number
        ) as rn
      from public.v_page_review_state s
      where s.user_id = v_caller
        and s.edition_id = v_plan.edition_id
        and s.is_weak
      order by s.last_reviewed_on asc nulls first, s.page_number
      limit v_weak_cap
    ) ranked;

    get diagnostics v_added = row_count;
    v_taken := v_taken + v_added;
  end if;

  -- 2. Sabqi, up to its own allocation and whatever budget is left.
  if v_plan.sabqi_daily_pages > 0 and v_taken < v_budget then
    insert into public.review_queue_items (queue_id, page_number, tier, position)
    select v_queue_id, ranked.page_number, 'sabqi', v_taken + ranked.rn
    from (
      select
        s.page_number,
        row_number() over (
          order by s.last_reviewed_on asc nulls first, s.page_number
        ) as rn
      from public.v_page_review_state s
      where s.user_id = v_caller
        and s.edition_id = v_plan.edition_id
        and s.tier = 'sabqi'
        and not exists (
          select 1 from public.review_queue_items existing
           where existing.queue_id = v_queue_id
             and existing.page_number = s.page_number
        )
      order by s.last_reviewed_on asc nulls first, s.page_number
      limit least(v_plan.sabqi_daily_pages, v_budget - v_taken)
    ) ranked;

    get diagnostics v_added = row_count;
    v_taken := v_taken + v_added;
  end if;

  -- 3. Manzil fills the remainder, contiguously from the cursor.
  --    The CASE in the ORDER BY puts pages at or after the cursor first, then
  --    wraps to the beginning, which is what makes the rotation a rotation.
  if v_taken < v_budget then
    insert into public.review_queue_items (queue_id, page_number, tier, position)
    select v_queue_id, ranked.page_number, 'manzil', v_taken + ranked.rn
    from (
      select
        s.page_number,
        row_number() over (
          order by
            case when s.page_number >= v_plan.manzil_cursor then 0 else 1 end,
            s.page_number
        ) as rn
      from public.v_page_review_state s
      where s.user_id = v_caller
        and s.edition_id = v_plan.edition_id
        and s.tier = 'manzil'
        and not exists (
          select 1 from public.review_queue_items existing
           where existing.queue_id = v_queue_id
             and existing.page_number = s.page_number
        )
      order by
        case when s.page_number >= v_plan.manzil_cursor then 0 else 1 end,
        s.page_number
      limit v_budget - v_taken
    ) ranked;
  end if;

  return v_queue_id;
end;
$$;

comment on function public.ensure_review_queue is
  'Idempotently builds the murajaah queue for a date. Weak pages capped at a third of the budget so the rotation still advances.';

-- ---------------------------------------------------------------------------
-- complete_queue_item
-- ---------------------------------------------------------------------------
-- Logs the review, marks the item done, and advances the rotation cursor when
-- the item came from manzil. All three in one transaction: a session recorded
-- without the cursor moving would replay the same page tomorrow.
-- ---------------------------------------------------------------------------
create or replace function public.complete_queue_item(
  p_item_id    uuid,
  p_confidence smallint,
  p_notes      text default null,
  p_duration_seconds integer default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_caller     uuid := auth.uid();
  v_item       public.review_queue_items%rowtype;
  v_queue      public.review_queues%rowtype;
  v_plan       public.review_plans%rowtype;
  v_page_range int4range;
  v_session_id uuid;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_confidence is null or p_confidence not between 1 and 5 then
    raise exception 'confidence must be between 1 and 5' using errcode = '22003';
  end if;

  select * into v_item from public.review_queue_items where id = p_item_id;
  if not found then
    raise exception 'queue item not found' using errcode = 'P0002';
  end if;

  -- Ownership is inherited through the queue. RLS already restricts what is
  -- visible, but this function reads the item by primary key, so the check is
  -- made explicitly rather than relying on a policy a later refactor might
  -- loosen.
  select * into v_queue from public.review_queues where id = v_item.queue_id;
  if not found or v_queue.user_id <> v_caller then
    raise exception 'queue item not found' using errcode = 'P0002';
  end if;

  if v_item.completed_at is not null then
    return v_item.session_id;
  end if;

  select * into v_plan from public.review_plans where user_id = v_caller;

  select p.ayah_range
    into v_page_range
    from public.mushaf_pages p
   where p.edition_id = v_plan.edition_id
     and p.page_number = v_item.page_number;

  if v_page_range is null then
    raise exception 'page % is not in edition %', v_item.page_number, v_plan.edition_id
      using errcode = '22023';
  end if;

  insert into public.review_sessions (
    user_id, ayah_range, reviewed_on, confidence, tier, notes, duration_seconds
  )
  values (
    v_caller, v_page_range, v_queue.queue_date, p_confidence, v_item.tier,
    nullif(btrim(coalesce(p_notes, '')), ''), p_duration_seconds
  )
  returning id into v_session_id;

  update public.review_queue_items
     set completed_at = now(),
         confidence   = p_confidence,
         session_id   = v_session_id
   where id = p_item_id;

  -- Advance the rotation past the page just reviewed. Wrapping at the edition
  -- boundary keeps the cursor inside its CHECK constraint, and the guard stops
  -- it rewinding when items are completed out of order.
  if v_item.tier = 'manzil' then
    update public.review_plans
       set manzil_cursor = case
             when v_item.page_number >= 604 then 1
             else (v_item.page_number + 1)::smallint
           end
     where user_id = v_caller
       and (v_item.page_number + 1) > manzil_cursor;
  end if;

  return v_session_id;
end;
$$;

comment on function public.complete_queue_item is
  'Records a review, marks the queue item done, and advances the manzil cursor. Atomic.';

-- ---------------------------------------------------------------------------
-- v_review_queue
-- ---------------------------------------------------------------------------
-- The day's queue joined to enough context to render it without a second call.
-- ---------------------------------------------------------------------------
create view public.v_review_queue
with (security_invoker = true) as
select
  q.user_id,
  q.queue_date,
  q.is_rest_day,
  q.page_budget,
  i.id            as item_id,
  i.page_number,
  i.tier,
  i.position,
  i.completed_at,
  i.confidence,
  (select a.juz from public.ayahs a where a.id = lower(p.ayah_range)) as juz,
  public.ayah_range_length(p.ayah_range) as ayah_count,
  s.name_transliterated as opening_surah
from public.review_queues q
join public.review_queue_items i on i.queue_id = q.id
join public.mushaf_pages p
  on p.page_number = i.page_number
 and p.edition_id = (
   select edition_id from public.review_plans rp where rp.user_id = q.user_id
 )
join public.ayahs a2 on a2.id = lower(p.ayah_range)
join public.surahs s on s.number = a2.surah_number;

comment on view public.v_review_queue is
  'Queue items joined to page and surah context for rendering.';

-- ---------------------------------------------------------------------------
-- v_review_streak
-- ---------------------------------------------------------------------------
-- Consecutive days with at least one completed review, in the user's own
-- timezone. Streaks computed in UTC appear to reset overnight for anyone east
-- or west of it, which is the single most common complaint about this kind of
-- feature.
-- ---------------------------------------------------------------------------
create view public.v_review_streak
with (security_invoker = true) as
with active_days as (
  select distinct
    r.user_id,
    (r.created_at at time zone coalesce(pr.timezone, 'UTC'))::date as local_day
  from public.review_sessions r
  join public.profiles pr on pr.id = r.user_id
),
grouped as (
  select
    user_id,
    local_day,
    local_day - (row_number() over (partition by user_id order by local_day))::integer
      as streak_group
  from active_days
),
runs as (
  select
    user_id,
    streak_group,
    min(local_day) as started_on,
    max(local_day) as ended_on,
    count(*)::integer as length
  from grouped
  group by user_id, streak_group
)
select
  user_id,
  max(length) as longest_streak,
  coalesce(
    max(length) filter (
      where ended_on >= (
        select (now() at time zone coalesce(pr2.timezone, 'UTC'))::date - 1
          from public.profiles pr2 where pr2.id = runs.user_id
      )
    ),
    0
  ) as current_streak,
  max(ended_on) as last_active_on
from runs
group by user_id;

comment on view public.v_review_streak is
  'Current and longest review streaks, computed against each user''s local day boundary.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.review_queues enable row level security;
alter table public.review_queue_items enable row level security;

create policy "review_queues_select_own" on public.review_queues
  for select to authenticated using (user_id = (select auth.uid()));

create policy "review_queues_insert_own" on public.review_queues
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "review_queues_delete_own" on public.review_queues
  for delete to authenticated using (user_id = (select auth.uid()));

-- Ownership inherited through the parent queue. There is deliberately no
-- user_id column here: two copies of ownership can disagree.
create policy "review_queue_items_select_via_queue" on public.review_queue_items
  for select to authenticated
  using (
    exists (
      select 1 from public.review_queues q
       where q.id = review_queue_items.queue_id
         and q.user_id = (select auth.uid())
    )
  );

create policy "review_queue_items_insert_via_queue" on public.review_queue_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.review_queues q
       where q.id = review_queue_items.queue_id
         and q.user_id = (select auth.uid())
    )
  );

create policy "review_queue_items_update_via_queue" on public.review_queue_items
  for update to authenticated
  using (
    exists (
      select 1 from public.review_queues q
       where q.id = review_queue_items.queue_id
         and q.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.review_queues q
       where q.id = review_queue_items.queue_id
         and q.user_id = (select auth.uid())
    )
  );
