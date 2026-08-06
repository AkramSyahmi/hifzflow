-- ---------------------------------------------------------------------------
-- 0008 · Activity
-- ---------------------------------------------------------------------------
-- Daily activity for the dashboard heatmap and consistency figures.
--
-- Both source tables already store dates rather than timestamps —
-- `review_sessions.reviewed_on` is the queue date, and
-- `memorisation_segments.memorised_on` is what the user entered — so these
-- views need no timezone conversion. The local-day boundary was resolved when
-- the row was written, which is the right place for it: converting at read
-- time would silently reinterpret history if someone changed timezone.
-- ---------------------------------------------------------------------------

create view public.v_daily_activity
with (security_invoker = true) as
with reviews as (
  select
    user_id,
    reviewed_on as day,
    count(*)::integer as review_count,
    sum(public.ayah_range_length(ayah_range))::integer as ayahs_reviewed
  from public.review_sessions
  group by user_id, reviewed_on
),
memorised as (
  select
    user_id,
    memorised_on as day,
    sum(public.ayah_range_length(ayah_range))::integer as ayahs_memorised
  from public.memorisation_segments
  where deleted_at is null
    and memorised_on is not null
  group by user_id, memorised_on
)
select
  coalesce(r.user_id, m.user_id) as user_id,
  coalesce(r.day, m.day)         as day,
  coalesce(r.review_count, 0)    as review_count,
  coalesce(r.ayahs_reviewed, 0)  as ayahs_reviewed,
  coalesce(m.ayahs_memorised, 0) as ayahs_memorised
from reviews r
full outer join memorised m
  on m.user_id = r.user_id and m.day = r.day;

comment on view public.v_daily_activity is
  'One row per day on which a user reviewed or memorised anything. Absent days had no activity.';

-- ---------------------------------------------------------------------------
-- v_activity_summary
-- ---------------------------------------------------------------------------
-- Consistency is expressed as days active out of the window rather than as a
-- streak. A streak rewards never missing; consistency describes what actually
-- happens, which is more useful for deciding whether a plan is realistic.
-- ---------------------------------------------------------------------------
create view public.v_activity_summary
with (security_invoker = true) as
select
  user_id,
  count(*) filter (where day >= current_date - 29)::integer  as days_active_30,
  count(*) filter (where day >= current_date - 89)::integer  as days_active_90,
  count(*)::integer                                          as days_active_total,
  sum(review_count)::integer                                 as total_reviews,
  min(day)                                                   as first_activity_on,
  max(day)                                                   as last_activity_on
from public.v_daily_activity
group by user_id;

comment on view public.v_activity_summary is
  'Consistency counts over rolling windows, plus lifetime totals.';

-- ---------------------------------------------------------------------------
-- activity_calendar
-- ---------------------------------------------------------------------------
-- The heatmap needs every day in the range, including empty ones. Generating
-- the series in SQL means the client renders whatever it is given rather than
-- reconciling a sparse list against a calendar it has to build itself.
-- ---------------------------------------------------------------------------
create or replace function public.activity_calendar(
  p_from date,
  p_to   date
)
returns table (
  day             date,
  review_count    integer,
  ayahs_reviewed  integer,
  ayahs_memorised integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    d::date                        as day,
    coalesce(a.review_count, 0)    as review_count,
    coalesce(a.ayahs_reviewed, 0)  as ayahs_reviewed,
    coalesce(a.ayahs_memorised, 0) as ayahs_memorised
  from generate_series(p_from, p_to, interval '1 day') d
  left join public.v_daily_activity a
    on a.day = d::date
   and a.user_id = auth.uid()
  order by d;
$$;

comment on function public.activity_calendar is
  'Every day in a range with its activity, empty days included, for the heatmap.';
