-- ---------------------------------------------------------------------------
-- Analytics
-- ---------------------------------------------------------------------------
-- The aggregates here become the basis for decisions about what to work on, so
-- the weighting and the honesty flags are asserted rather than trusted.
-- ---------------------------------------------------------------------------

\echo '== Analytics =='

insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'hamza@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, display_name, timezone)
values ('77777777-7777-7777-7777-777777777777', 'Hamza', 'Asia/Kuala_Lumpur')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Strength weighting and the measurement threshold
-- ---------------------------------------------------------------------------
do $$
declare
  hamza uuid := '77777777-7777-7777-7777-777777777777';
  page_a int4range;
  page_b int4range;
begin
  perform test.become(hamza);

  insert into public.review_plans (user_id, edition_id, daily_pages)
  values (hamza, 1, 4);

  -- Two pages of juz 30, memorised long enough ago to be manzil.
  perform public.record_pages(1::smallint, 590::smallint, 591::smallint);
  update public.memorisation_segments
     set memorised_on = current_date - 200
   where user_id = hamza;

  select ayah_range into page_a from public.mushaf_pages
   where edition_id = 1 and page_number = 590;
  select ayah_range into page_b from public.mushaf_pages
   where edition_id = 1 and page_number = 591;

  -- Page 590: reviewed once, rated 5. Impressive but barely measured.
  insert into public.review_sessions (user_id, ayah_range, reviewed_on, confidence, tier)
  values (hamza, page_a, current_date - 20, 5, 'manzil');

  -- Page 591: reviewed four times, mean 4.0, most recent 4.
  insert into public.review_sessions (user_id, ayah_range, reviewed_on, confidence, tier)
  values
    (hamza, page_b, current_date - 25, 3, 'manzil'),
    (hamza, page_b, current_date - 18, 4, 'manzil'),
    (hamza, page_b, current_date - 11, 5, 'manzil'),
    (hamza, page_b, current_date - 4,  4, 'manzil');

  perform test.equals(
    (select review_count::int from public.v_page_strength where page_number = 590),
    1,
    'a single review is counted'
  );
  perform test.ok(
    (select is_measured from public.v_page_strength where page_number = 590) = false,
    'one review is not enough evidence to rank a page'
  );
  perform test.ok(
    (select is_measured from public.v_page_strength where page_number = 591),
    'four reviews is enough to rank a page'
  );

  perform test.equals(
    (select average_confidence from public.v_page_strength where page_number = 591),
    4.00::numeric,
    'average confidence is the mean of every review'
  );
  perform test.equals(
    (select lowest_confidence::int from public.v_page_strength where page_number = 591),
    3,
    'the worst rating is retained'
  );

  -- Strength is (mean + 2 * latest) / 3 = (4 + 8) / 3 = 4.00.
  perform test.equals(
    (select strength from public.v_page_strength where page_number = 591),
    4.00::numeric,
    'strength blends mean and latest, two to one toward recency'
  );

  -- A recent poor rating must pull strength down even with a good history.
  insert into public.review_sessions (user_id, ayah_range, reviewed_on, confidence, tier)
  values (hamza, page_b, current_date, 1, 'manzil');

  perform test.ok(
    (select strength from public.v_page_strength where page_number = 591) < 2.5,
    'a recent poor rating dominates a good history'
  );
  perform test.ok(
    (select average_confidence from public.v_page_strength where page_number = 591) > 3,
    'the historical mean is not discarded, only outweighed'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Review trend
-- ---------------------------------------------------------------------------
do $$
declare
  hamza uuid := '77777777-7777-7777-7777-777777777777';
  bucket_count integer;
begin
  perform test.become(hamza);

  select count(*)::int into bucket_count
    from public.review_trend(current_date - 55, current_date);
  perform test.ok(bucket_count >= 8, 'the trend returns a bucket per week');

  -- Quiet weeks must be present as zeroes. A chart that omits the fortnight
  -- someone stopped reviewing tells the opposite of the truth.
  perform test.ok(
    exists (
      select 1 from public.review_trend(current_date - 300, current_date)
       where total_reviews = 0
    ),
    'weeks with no reviews are returned as zeroes'
  );

  perform test.equals(
    (select sum(total_reviews)::int
       from public.review_trend(current_date - 55, current_date)),
    6,
    'the trend counts every review in the window'
  );
  perform test.equals(
    (select sum(manzil_reviews)::int
       from public.review_trend(current_date - 55, current_date)),
    6,
    'reviews are attributed to their tier'
  );
  perform test.ok(
    (select average_confidence
       from public.review_trend(current_date - 6, current_date)
      where total_reviews > 0
      limit 1) is not null,
    'a week with reviews reports mean confidence'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Memorisation growth
-- ---------------------------------------------------------------------------
do $$
declare
  hamza uuid := '77777777-7777-7777-7777-777777777777';
  first_total integer;
  last_total integer;
begin
  perform test.become(hamza);

  -- Everything so far was dated 200 days ago, so a recent window must start at
  -- that height rather than at zero.
  select cumulative_ayahs into first_total
    from public.memorisation_growth(current_date - 30, current_date)
   order by day limit 1;
  perform test.ok(
    first_total > 0,
    'the curve is seeded with everything recorded before the window'
  );

  perform public.record_memorisation(
    1000, 1019, 'memorised', null, current_date - 10
  );

  select cumulative_ayahs into last_total
    from public.memorisation_growth(current_date - 30, current_date)
   order by day desc limit 1;

  perform test.equals(
    last_total, first_total + 20,
    'the running total rises by exactly what was added'
  );
  perform test.equals(
    (select ayahs_added::int from public.memorisation_growth(
       current_date - 30, current_date
     ) where day = current_date - 10),
    20,
    'the daily figure lands on the recorded date'
  );
  perform test.equals(
    (select count(*)::int from public.memorisation_growth(
       current_date - 6, current_date
     )),
    7,
    'every day in the window is returned'
  );

  -- The curve must never fall.
  perform test.ok(
    not exists (
      select 1 from (
        select cumulative_ayahs,
               lag(cumulative_ayahs) over (order by day) as previous
          from public.memorisation_growth(current_date - 60, current_date)
      ) t
      where previous is not null and cumulative_ayahs < previous
    ),
    'the cumulative curve is monotonic'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Totals and isolation
-- ---------------------------------------------------------------------------
do $$
declare
  hamza uuid := '77777777-7777-7777-7777-777777777777';
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
begin
  perform test.become(hamza);

  perform test.equals(
    (select total_reviews::int from public.v_review_totals where user_id = hamza),
    6,
    'lifetime totals count every review'
  );
  perform test.equals(
    (select manzil_reviews::int from public.v_review_totals where user_id = hamza),
    6,
    'tier totals add up'
  );

  perform test.become(yusuf);
  perform test.equals(
    (select count(distinct user_id)::int from public.v_page_strength),
    1,
    'page strength does not leak across users'
  );
  perform test.equals(
    (select count(distinct user_id)::int from public.v_review_totals),
    1,
    'review totals do not leak across users'
  );
  perform test.equals(
    (select coalesce(sum(total_reviews), 0)::int
       from public.review_trend(current_date - 55, current_date)),
    (select coalesce(count(*), 0)::int from public.review_sessions
      where user_id = yusuf and reviewed_on >= current_date - 55),
    'the trend reports only the caller''s reviews'
  );
end
$$;

\echo '   analytics OK'
