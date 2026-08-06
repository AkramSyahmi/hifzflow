-- ---------------------------------------------------------------------------
-- Activity
-- ---------------------------------------------------------------------------

\echo '== Activity =='

do $$
declare
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
  maryam uuid := '55555555-5555-5555-5555-555555555555';
  active_days integer;
begin
  perform test.become(yusuf);

  -- Yusuf reviewed today in the murajaah suite, so today must appear.
  perform test.ok(
    exists (
      select 1 from public.v_daily_activity
       where user_id = yusuf and day = current_date and review_count > 0
    ),
    'a day with reviews appears in daily activity'
  );

  -- Memorisation with a recorded date contributes even without any review.
  perform public.record_memorisation(2000, 2010, 'memorised', null, current_date - 3);
  perform test.equals(
    (select ayahs_memorised from public.v_daily_activity
      where user_id = yusuf and day = current_date - 3),
    11,
    'memorisation is counted on the date it was recorded'
  );
  perform test.equals(
    (select review_count from public.v_daily_activity
      where user_id = yusuf and day = current_date - 3),
    0,
    'a memorisation-only day reports no reviews'
  );

  -- Days with no activity at all must be absent, not present with zeroes.
  perform test.equals(
    (select count(*)::int from public.v_daily_activity
      where user_id = yusuf and day = current_date - 400),
    0,
    'inactive days do not appear in the view'
  );

  select days_active_30 into active_days
    from public.v_activity_summary where user_id = yusuf;
  perform test.ok(active_days >= 2, 'the 30 day window counts distinct active days');

  -- The calendar function fills the gaps the view deliberately leaves out.
  perform test.equals(
    (select count(*)::int from public.activity_calendar(
       current_date - 9, current_date
     )),
    10,
    'the calendar returns every day in the range'
  );
  perform test.ok(
    exists (
      select 1 from public.activity_calendar(current_date - 9, current_date)
       where review_count = 0 and ayahs_memorised = 0
    ),
    'empty days are returned with zeroes rather than omitted'
  );
  perform test.equals(
    (select ayahs_memorised from public.activity_calendar(
       current_date - 9, current_date
     ) where day = current_date - 3),
    11,
    'the calendar carries through the activity it does have'
  );

  -- Isolation: the calendar is filtered by auth.uid() inside the function, so
  -- it must not fall back to showing everybody when the caller changes.
  perform test.become(maryam);
  perform test.equals(
    (select coalesce(sum(ayahs_memorised), 0)::int
       from public.activity_calendar(current_date - 3, current_date - 3)),
    0,
    'the calendar does not leak another user''s activity'
  );
  perform test.equals(
    (select count(distinct user_id)::int from public.v_daily_activity),
    1,
    'daily activity does not leak across users'
  );
end
$$;

\echo '   activity OK'
