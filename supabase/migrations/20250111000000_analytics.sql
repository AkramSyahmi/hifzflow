-- ---------------------------------------------------------------------------
-- 0011 · Analytics
-- ---------------------------------------------------------------------------
-- Aggregates for the analytics page. Two decisions are worth stating up front
-- because they change what the numbers mean.
--
-- 1. Strength is not average confidence alone. A page reviewed once and rated
--    five is not stronger than one reviewed twenty times averaging four and a
--    half — it is simply less measured. Pages below a minimum review count are
--    reported as insufficiently sampled rather than ranked, so "strongest
--    pages" does not become a list of lucky first impressions.
--
-- 2. Recency is weighted. A page rated two last week and five a year ago is
--    weak now. The strength score leans on recent reviews without discarding
--    history entirely.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- v_page_strength
-- ---------------------------------------------------------------------------
-- One row per memorised page with its full review record.
--
-- `strength` blends the mean rating with the most recent one, two to one in
-- favour of recency. `is_measured` is the honesty flag: below three reviews
-- there is not enough evidence to call a page strong or weak, and the UI says
-- so instead of ranking it.
-- ---------------------------------------------------------------------------
create view public.v_page_strength
with (security_invoker = true) as
with reviewed as (
  select
    s.user_id,
    s.edition_id,
    s.page_number,
    s.juz,
    s.tier,
    s.review_count,
    s.last_confidence,
    s.last_reviewed_on,
    s.days_since_review,
    (
      select round(avg(r.confidence), 2)
        from public.review_sessions r
        join public.mushaf_pages p
          on p.edition_id = s.edition_id
         and p.page_number = s.page_number
       where r.user_id = s.user_id
         and r.ayah_range && p.ayah_range
    ) as average_confidence,
    (
      select min(r.confidence)
        from public.review_sessions r
        join public.mushaf_pages p
          on p.edition_id = s.edition_id
         and p.page_number = s.page_number
       where r.user_id = s.user_id
         and r.ayah_range && p.ayah_range
    ) as lowest_confidence
  from public.v_page_review_state s
)
select
  user_id,
  edition_id,
  page_number,
  juz,
  tier,
  review_count,
  average_confidence,
  lowest_confidence,
  last_confidence,
  last_reviewed_on,
  days_since_review,
  (review_count >= 3) as is_measured,
  case
    when review_count = 0 or average_confidence is null then null
    -- Two parts recent rating to one part historical mean.
    else round(
      (average_confidence + (2 * last_confidence)) / 3.0, 2
    )
  end as strength
from reviewed;

comment on view public.v_page_strength is
  'Per-page review record with a recency-weighted strength score. is_measured is false below three reviews.';

-- ---------------------------------------------------------------------------
-- review_trend
-- ---------------------------------------------------------------------------
-- Weekly review volume split by tier, with the week's mean confidence.
--
-- Buckets are generated so quiet weeks appear as zeroes rather than vanishing.
-- A chart that silently omits the fortnight someone stopped reviewing tells the
-- opposite of the truth.
-- ---------------------------------------------------------------------------
create or replace function public.review_trend(
  p_from date,
  p_to   date
)
returns table (
  week_start        date,
  total_reviews     integer,
  sabqi_reviews     integer,
  manzil_reviews    integer,
  weak_reviews      integer,
  average_confidence numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with weeks as (
    -- Stepping weekly from p_from can stop short of the week containing p_to,
    -- which silently drops the current week — the one that matters most on a
    -- chart. Generating between the truncated bounds guarantees it is present.
    select d::date as week_start
      from generate_series(
        date_trunc('week', p_from),
        date_trunc('week', p_to),
        interval '1 week'
      ) d
  ),
  sessions as (
    select
      date_trunc('week', reviewed_on)::date as week_start,
      tier,
      confidence
    from public.review_sessions
    where user_id = auth.uid()
      and reviewed_on between p_from and p_to
  )
  select
    w.week_start,
    count(s.confidence)::integer as total_reviews,
    count(*) filter (where s.tier = 'sabqi')::integer  as sabqi_reviews,
    count(*) filter (where s.tier = 'manzil')::integer as manzil_reviews,
    count(*) filter (where s.tier = 'weak')::integer   as weak_reviews,
    round(avg(s.confidence), 2) as average_confidence
  from weeks w
  left join sessions s on s.week_start = w.week_start
  group by w.week_start
  order by w.week_start;
$$;

comment on function public.review_trend is
  'Weekly review volume by tier with mean confidence. Empty weeks are returned as zeroes.';

-- ---------------------------------------------------------------------------
-- memorisation_growth
-- ---------------------------------------------------------------------------
-- Cumulative memorised ayahs over time.
--
-- The running total is computed from segment dates rather than from a stored
-- counter, so it stays correct when a segment is edited, removed or backdated.
-- Segments with no recorded date are excluded: placing them at an arbitrary
-- point would put a step in the curve that never happened.
-- ---------------------------------------------------------------------------
create or replace function public.memorisation_growth(
  p_from date,
  p_to   date
)
returns table (
  day             date,
  ayahs_added     integer,
  cumulative_ayahs integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with daily as (
    select
      memorised_on as day,
      sum(public.ayah_range_length(ayah_range))::integer as added
    from public.memorisation_segments
    where user_id = auth.uid()
      and deleted_at is null
      and status = 'memorised'
      and memorised_on is not null
    group by memorised_on
  ),
  -- Everything recorded before the window is the curve's starting height.
  baseline as (
    select coalesce(sum(added), 0)::integer as total
      from daily where day < p_from
  ),
  span as (
    select d::date as day from generate_series(p_from, p_to, interval '1 day') d
  )
  select
    s.day,
    coalesce(daily.added, 0) as ayahs_added,
    (
      (select total from baseline)
      + coalesce(
          sum(coalesce(daily.added, 0)) over (order by s.day rows unbounded preceding),
          0
        )
    )::integer as cumulative_ayahs
  from span s
  left join daily on daily.day = s.day
  order by s.day;
$$;

comment on function public.memorisation_growth is
  'Cumulative memorised ayahs per day, seeded with everything recorded before the window.';

-- ---------------------------------------------------------------------------
-- v_review_totals
-- ---------------------------------------------------------------------------
create view public.v_review_totals
with (security_invoker = true) as
select
  user_id,
  count(*)::integer                                        as total_reviews,
  count(distinct reviewed_on)::integer                     as review_days,
  round(avg(confidence), 2)                                as average_confidence,
  count(*) filter (where tier = 'sabqi')::integer           as sabqi_reviews,
  count(*) filter (where tier = 'manzil')::integer          as manzil_reviews,
  count(*) filter (where tier = 'weak')::integer            as weak_reviews,
  sum(public.ayah_range_length(ayah_range))::integer        as ayahs_reviewed,
  min(reviewed_on)                                         as first_review_on,
  max(reviewed_on)                                         as last_review_on
from public.review_sessions
group by user_id;

comment on view public.v_review_totals is
  'Lifetime review totals per user.';
