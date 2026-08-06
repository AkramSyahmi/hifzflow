-- ---------------------------------------------------------------------------
-- 0006 · Murajaah — plans, review log, and review state
-- ---------------------------------------------------------------------------
-- The scheduling model follows the structure tahfiz institutions already use,
-- rather than a generic spaced-repetition scheme:
--
--   sabaq   new memorisation, today's lesson
--   sabqi   recent memorisation still being consolidated
--   manzil  everything older, cycled continuously
--
-- This matters because huffaz recite contiguous blocks. A card-optimal
-- scheduler produces a queue like "page 12, page 340, page 89" which is
-- theoretically sound and practically unusable: you cannot recite it. The
-- manzil rotation therefore advances through a cursor, the way a physical
-- rotation does, and weak passages are layered on top rather than replacing it.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- review_plans
-- ---------------------------------------------------------------------------
-- One active plan per user. The daily budget can be expressed two ways:
--
--   daily_quantity  "two pages a day" — the budget is fixed, the cycle length
--                   grows as more is memorised
--   cycle_length    "everything I know, every 30 days" — the cycle is fixed
--                   and the daily budget grows instead
--
-- Both reduce to a pages-per-day number, so there is one engine and two ways
-- of expressing intent. `effective_daily_pages()` below does the conversion.
-- ---------------------------------------------------------------------------
create table public.review_plans (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users (id) on delete cascade,
  edition_id         smallint    not null references public.mushaf_editions (id),

  mode               text        not null default 'daily_quantity',
  daily_pages        smallint    not null default 4,
  cycle_days         smallint    not null default 30,

  -- Sabqi window: how long newly memorised material stays in intensive review.
  sabqi_window_days  smallint    not null default 30,
  sabqi_daily_pages  smallint    not null default 2,

  -- Weak passages are pulled forward when their last recorded confidence is at
  -- or below this threshold.
  include_weak       boolean     not null default true,
  weak_threshold     smallint    not null default 2,

  -- Cursor into the manzil rotation: the next page due. This is what keeps the
  -- queue contiguous and predictable between days.
  manzil_cursor      smallint    not null default 1,

  -- Days of the week with no scheduled review. 0 is Sunday, matching
  -- extract(dow), so the value can be compared without translation.
  rest_days          smallint[]  not null default '{}',

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint review_plans_one_per_user unique (user_id),
  constraint review_plans_mode
    check (mode in ('daily_quantity', 'cycle_length')),
  constraint review_plans_daily_pages_range
    check (daily_pages between 1 and 60),
  constraint review_plans_cycle_days_range
    check (cycle_days between 1 and 365),
  constraint review_plans_sabqi_window_range
    check (sabqi_window_days between 0 and 365),
  constraint review_plans_sabqi_daily_range
    check (sabqi_daily_pages between 0 and 60),
  constraint review_plans_weak_threshold_range
    check (weak_threshold between 1 and 5),
  constraint review_plans_cursor_range
    check (manzil_cursor between 1 and 604),
  constraint review_plans_rest_days_valid
    check (
      rest_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
      and array_length(rest_days, 1) is distinct from 7
    )
);

comment on table public.review_plans is
  'One murajaah plan per user. Daily budget expressed as a fixed quantity or a fixed cycle length.';
comment on column public.review_plans.manzil_cursor is
  'Next page due in the long rotation. Keeps the daily queue contiguous between days.';
comment on column public.review_plans.rest_days is
  'Days of week with no scheduled review, 0 = Sunday to match extract(dow).';

create trigger review_plans_set_updated_at
  before update on public.review_plans
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- review_sessions
-- ---------------------------------------------------------------------------
-- The log of what was actually reviewed. Unlike memorisation_segments these
-- ranges are expected to overlap heavily — the same page is reviewed dozens of
-- times — so there is no exclusion constraint.
-- ---------------------------------------------------------------------------
create table public.review_sessions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,
  ayah_range       int4range   not null,
  reviewed_on      date        not null default current_date,
  confidence       smallint    not null,
  tier             text        not null,
  duration_seconds integer,
  notes            text,
  created_at       timestamptz not null default now(),

  constraint review_sessions_confidence_range
    check (confidence between 1 and 5),
  constraint review_sessions_tier
    check (tier in ('sabaq', 'sabqi', 'manzil', 'weak')),
  constraint review_sessions_range_bounded
    check (lower(ayah_range) >= 1 and upper(ayah_range) <= 6237),
  constraint review_sessions_range_nonempty
    check (not isempty(ayah_range)),
  constraint review_sessions_duration_sane
    check (duration_seconds is null or duration_seconds between 1 and 86400),
  constraint review_sessions_notes_length
    check (notes is null or char_length(notes) <= 2000),
  constraint review_sessions_not_future
    check (reviewed_on <= (current_date + 1))
);

comment on table public.review_sessions is
  'Every murajaah session. Ranges overlap freely; the same passage is reviewed many times.';

create index review_sessions_user_date_idx
  on public.review_sessions (user_id, reviewed_on desc);

create index review_sessions_range_idx
  on public.review_sessions using gist (user_id, ayah_range);

create index review_sessions_weak_idx
  on public.review_sessions (user_id, reviewed_on desc)
  where confidence <= 2;

-- ---------------------------------------------------------------------------
-- effective_daily_pages
-- ---------------------------------------------------------------------------
-- Converts either plan mode into a pages-per-day number.
--
-- In cycle_length mode the budget grows with the amount memorised, which is the
-- point: "everything I know every 30 days" means more pages per day as you
-- learn more. The floor of 1 stops a nearly-empty account producing a budget of
-- zero and an empty queue forever.
-- ---------------------------------------------------------------------------
create or replace function public.effective_daily_pages(
  p_plan_id uuid
)
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  plan public.review_plans%rowtype;
  memorised_pages integer;
begin
  select * into plan from public.review_plans where id = p_plan_id;
  if not found then
    return 0;
  end if;

  if plan.mode = 'daily_quantity' then
    return plan.daily_pages;
  end if;

  select count(*)::integer
    into memorised_pages
    from public.mushaf_pages p
   where p.edition_id = plan.edition_id
     and exists (
       select 1
         from public.memorisation_segments s
        where s.user_id = plan.user_id
          and s.deleted_at is null
          and s.status = 'memorised'
          and s.ayah_range @> p.ayah_range
     );

  return greatest(1, ceil(coalesce(memorised_pages, 0)::numeric / plan.cycle_days)::integer);
end;
$$;

comment on function public.effective_daily_pages is
  'Pages per day for a plan, converting cycle_length mode into a quantity.';

-- ---------------------------------------------------------------------------
-- v_page_review_state
-- ---------------------------------------------------------------------------
-- One row per fully memorised page, with everything the scheduler needs. Pages
-- only partially memorised are excluded: reviewing half a page is a different
-- activity, and including them would make the daily count dishonest.
--
-- This is the single source the queue generator reads from, so the definitions
-- of "weak" and "which tier" exist in exactly one place.
-- ---------------------------------------------------------------------------
create view public.v_page_review_state
with (security_invoker = true) as
with plans as (
  select user_id, edition_id, sabqi_window_days, weak_threshold
    from public.review_plans
),
memorised_pages as (
  select
    pl.user_id,
    p.edition_id,
    p.page_number,
    p.ayah_range,
    pl.sabqi_window_days,
    pl.weak_threshold,
    (select min(s.memorised_on)
       from public.memorisation_segments s
      where s.user_id = pl.user_id
        and s.deleted_at is null
        and s.ayah_range && p.ayah_range) as memorised_on
  from plans pl
  join public.mushaf_pages p on p.edition_id = pl.edition_id
  where exists (
    select 1
      from public.memorisation_segments s
     where s.user_id = pl.user_id
       and s.deleted_at is null
       and s.status = 'memorised'
       and s.ayah_range @> p.ayah_range
  )
),
last_review as (
  select distinct on (mp.user_id, mp.page_number)
    mp.user_id,
    mp.page_number,
    r.reviewed_on,
    r.confidence
  from memorised_pages mp
  join public.review_sessions r
    on r.user_id = mp.user_id
   and r.ayah_range && mp.ayah_range
  order by mp.user_id, mp.page_number, r.reviewed_on desc, r.created_at desc
),
review_counts as (
  select mp.user_id, mp.page_number, count(r.id)::integer as review_count
    from memorised_pages mp
    left join public.review_sessions r
      on r.user_id = mp.user_id
     and r.ayah_range && mp.ayah_range
   group by mp.user_id, mp.page_number
)
select
  mp.user_id,
  mp.edition_id,
  mp.page_number,
  (select a.juz from public.ayahs a where a.id = lower(mp.ayah_range)) as juz,
  mp.memorised_on,
  lr.reviewed_on as last_reviewed_on,
  lr.confidence  as last_confidence,
  coalesce(rc.review_count, 0) as review_count,
  case
    when mp.memorised_on is null then 'manzil'
    when mp.memorised_on >= current_date - mp.sabqi_window_days then 'sabqi'
    else 'manzil'
  end as tier,
  (lr.confidence is not null and lr.confidence <= mp.weak_threshold) as is_weak,
  case
    when lr.reviewed_on is null then null
    else (current_date - lr.reviewed_on)
  end as days_since_review
from memorised_pages mp
left join last_review lr
  on lr.user_id = mp.user_id and lr.page_number = mp.page_number
left join review_counts rc
  on rc.user_id = mp.user_id and rc.page_number = mp.page_number;

comment on view public.v_page_review_state is
  'Every fully memorised page with its tier, last review and weakness. The only definition of those terms.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.review_plans enable row level security;
alter table public.review_sessions enable row level security;

create policy "review_plans_select_own" on public.review_plans
  for select to authenticated using (user_id = (select auth.uid()));

create policy "review_plans_insert_own" on public.review_plans
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "review_plans_update_own" on public.review_plans
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "review_plans_delete_own" on public.review_plans
  for delete to authenticated using (user_id = (select auth.uid()));

revoke update (id, user_id, created_at, updated_at)
  on public.review_plans from authenticated;

create policy "review_sessions_select_own" on public.review_sessions
  for select to authenticated using (user_id = (select auth.uid()));

create policy "review_sessions_insert_own" on public.review_sessions
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "review_sessions_update_own" on public.review_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke update (id, user_id, created_at)
  on public.review_sessions from authenticated;
