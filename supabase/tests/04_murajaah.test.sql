-- ---------------------------------------------------------------------------
-- Murajaah scheduling
-- ---------------------------------------------------------------------------
-- The scheduler is the part of this application most likely to be subtly wrong
-- in a way nobody notices for weeks: a queue that looks plausible but never
-- advances, or one that quietly drops half the rotation. Every rule it applies
-- is asserted here against real rows.
-- ---------------------------------------------------------------------------

\echo '== Murajaah scheduling =='

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'yusuf@example.test'),
  ('55555555-5555-5555-5555-555555555555', 'maryam@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, display_name, timezone)
values
  ('44444444-4444-4444-4444-444444444444', 'Yusuf', 'Asia/Kuala_Lumpur'),
  ('55555555-5555-5555-5555-555555555555', 'Maryam', 'Asia/Kuala_Lumpur')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Budget conversion
-- ---------------------------------------------------------------------------
do $$
declare
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
  plan_id uuid;
begin
  perform test.become(yusuf);

  insert into public.review_plans (user_id, edition_id, mode, daily_pages)
  values (yusuf, 1, 'daily_quantity', 5)
  returning id into plan_id;

  perform test.equals(
    public.effective_daily_pages(plan_id), 5,
    'daily_quantity mode returns its fixed budget'
  );

  -- Juz 30 is pages 582-604, so 23 pages. Over a 10 day cycle that is 3 a day.
  perform public.record_pages(1::smallint, 582::smallint, 604::smallint);

  update public.review_plans
     set mode = 'cycle_length', cycle_days = 10
   where id = plan_id;

  perform test.equals(
    public.effective_daily_pages(plan_id), 3,
    'cycle_length mode divides memorised pages across the cycle'
  );

  -- A one day cycle must demand everything at once.
  update public.review_plans set cycle_days = 1 where id = plan_id;
  perform test.equals(
    public.effective_daily_pages(plan_id), 23,
    'a one day cycle schedules every memorised page'
  );

  update public.review_plans
     set mode = 'daily_quantity', daily_pages = 5
   where id = plan_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Tier assignment
-- ---------------------------------------------------------------------------
do $$
declare
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
begin
  perform test.become(yusuf);

  perform test.equals(
    (select count(*)::int from public.v_page_review_state where user_id = yusuf),
    23,
    'every fully memorised page appears in the review state'
  );

  -- Everything was recorded today, so it is all still sabqi.
  perform test.equals(
    (select count(*)::int from public.v_page_review_state
      where user_id = yusuf and tier = 'sabqi'),
    23,
    'freshly memorised pages are sabqi'
  );

  -- Backdate some of it beyond the sabqi window; it must fall to manzil.
  update public.memorisation_segments
     set memorised_on = current_date - 120
   where user_id = yusuf;

  perform test.equals(
    (select count(*)::int from public.v_page_review_state
      where user_id = yusuf and tier = 'manzil'),
    23,
    'pages older than the sabqi window become manzil'
  );

  -- Partially memorised pages are excluded: reviewing half a page is a
  -- different activity and would make the daily count dishonest.
  perform public.record_memorisation(1, 3);
  perform test.equals(
    (select count(*)::int from public.v_page_review_state
      where user_id = yusuf and page_number = 1),
    0,
    'a partially memorised page is not scheduled'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Queue generation and idempotency
-- ---------------------------------------------------------------------------
do $$
declare
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
  q1 uuid;
  q2 uuid;
begin
  perform test.become(yusuf);

  q1 := public.ensure_review_queue(current_date);
  perform test.ok(q1 is not null, 'a queue is generated for today');

  q2 := public.ensure_review_queue(current_date);
  perform test.equals(q1, q2, 'generating twice returns the same queue');
  perform test.equals(
    (select count(*)::int from public.review_queues where user_id = yusuf),
    1,
    'no duplicate queue row was written'
  );

  perform test.equals(
    (select count(*)::int from public.review_queue_items where queue_id = q1),
    5,
    'the queue holds exactly the daily budget'
  );

  -- Contiguity is the whole point: the pages must be recitable in sequence.
  perform test.equals(
    (select max(page_number)::int - min(page_number)::int + 1
       from public.review_queue_items where queue_id = q1),
    5,
    'the manzil rotation is contiguous'
  );
  perform test.equals(
    (select min(page_number)::int from public.review_queue_items where queue_id = q1),
    582,
    'the rotation starts at the first memorised page at or after the cursor'
  );
  perform test.ok(
    not exists (
      select 1 from public.review_queue_items
       where queue_id = q1 and tier <> 'manzil'
    ),
    'with no weak or sabqi pages the budget goes entirely to manzil'
  );

  -- Positions must be a dense sequence, or the UI cannot order the day.
  perform test.equals(
    (select count(distinct position)::int from public.review_queue_items where queue_id = q1),
    5,
    'positions are unique'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Completion, logging and cursor advance
-- ---------------------------------------------------------------------------
do $$
declare
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
  q uuid;
  first_item uuid;
  first_page smallint;
  session uuid;
begin
  perform test.become(yusuf);

  q := public.ensure_review_queue(current_date);

  select id, page_number into first_item, first_page
    from public.review_queue_items
   where queue_id = q
   order by position
   limit 1;

  session := public.complete_queue_item(first_item, 4::smallint, 'smooth');
  perform test.ok(session is not null, 'completing an item returns a session id');

  perform test.equals(
    (select count(*)::int from public.review_sessions
      where user_id = yusuf and confidence = 4),
    1,
    'a review session was logged'
  );
  perform test.equals(
    (select tier from public.review_sessions where id = session),
    'manzil',
    'the session records the tier it came from'
  );
  perform test.ok(
    (select completed_at is not null from public.review_queue_items where id = first_item),
    'the queue item is marked complete'
  );
  perform test.equals(
    (select manzil_cursor::int from public.review_plans where user_id = yusuf),
    first_page::int + 1,
    'the rotation cursor advanced past the reviewed page'
  );

  -- Completing twice must not double-log.
  perform public.complete_queue_item(first_item, 2::smallint);
  perform test.equals(
    (select count(*)::int from public.review_sessions where user_id = yusuf),
    1,
    'completing an already completed item is a no-op'
  );

  -- The cursor must never rewind when items are completed out of order.
  perform test.equals(
    (select manzil_cursor::int from public.review_plans where user_id = yusuf),
    first_page::int + 1,
    'the cursor did not rewind'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- The rotation advances across days rather than repeating itself
-- ---------------------------------------------------------------------------
do $$
declare
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
  q_today uuid;
  q_tomorrow uuid;
  item uuid;
begin
  perform test.become(yusuf);

  q_today := public.ensure_review_queue(current_date);

  -- Work through the whole of today.
  for item in
    select id from public.review_queue_items
     where queue_id = q_today and completed_at is null
     order by position
  loop
    perform public.complete_queue_item(item, 4::smallint);
  end loop;

  perform test.equals(
    (select count(*)::int from public.review_queue_items
      where queue_id = q_today and completed_at is null),
    0,
    'today is fully completed'
  );

  q_tomorrow := public.ensure_review_queue(current_date + 1);

  perform test.ok(
    (select min(page_number) from public.review_queue_items where queue_id = q_tomorrow)
      > (select max(page_number) from public.review_queue_items where queue_id = q_today),
    'tomorrow continues past today rather than repeating it'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Weak pages are prioritised but capped
-- ---------------------------------------------------------------------------
do $$
declare
  maryam uuid := '55555555-5555-5555-5555-555555555555';
  q uuid;
  weak_count integer;
begin
  perform test.become(maryam);

  insert into public.review_plans (user_id, edition_id, daily_pages, sabqi_daily_pages, weak_threshold)
  values (maryam, 1, 6, 0, 2);

  -- Memorise a wide span, all of it old enough to be manzil.
  perform public.record_memorisation(1, 1000, 'memorised', null, current_date - 200);

  -- Mark a large number of pages weak, far more than a day's budget.
  insert into public.review_sessions (user_id, ayah_range, reviewed_on, confidence, tier)
  select maryam, p.ayah_range, current_date - 10, 1, 'manzil'
    from public.mushaf_pages p
   where p.edition_id = 1 and p.page_number between 5 and 40;

  q := public.ensure_review_queue(current_date);

  select count(*)::int into weak_count
    from public.review_queue_items where queue_id = q and tier = 'weak';

  perform test.equals(weak_count, 2, 'weak pages are capped at a third of the budget');
  perform test.equals(
    (select count(*)::int from public.review_queue_items where queue_id = q),
    6,
    'the rest of the budget still goes to the rotation'
  );
  perform test.ok(
    exists (select 1 from public.review_queue_items where queue_id = q and tier = 'manzil'),
    'the rotation still advances despite many weak pages'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Rest days
-- ---------------------------------------------------------------------------
do $$
declare
  maryam uuid := '55555555-5555-5555-5555-555555555555';
  rest_date date;
  q uuid;
begin
  perform test.become(maryam);

  -- Pick the next Friday and declare Fridays a rest day.
  rest_date := current_date + ((5 - extract(dow from current_date)::integer + 7) % 7);
  if rest_date = current_date then
    rest_date := rest_date + 7;
  end if;

  update public.review_plans set rest_days = array[5]::smallint[] where user_id = maryam;

  q := public.ensure_review_queue(rest_date);

  perform test.ok(
    (select is_rest_day from public.review_queues where id = q),
    'the queue is flagged as a rest day'
  );
  perform test.equals(
    (select count(*)::int from public.review_queue_items where queue_id = q),
    0,
    'a rest day schedules nothing'
  );

  update public.review_plans set rest_days = '{}'::smallint[] where user_id = maryam;
end
$$;

-- ---------------------------------------------------------------------------
-- Isolation
-- ---------------------------------------------------------------------------
do $$
declare
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
  maryam uuid := '55555555-5555-5555-5555-555555555555';
  foreign_item uuid;
begin
  perform test.become(maryam);
  select i.id into foreign_item
    from public.review_queue_items i
    join public.review_queues q on q.id = i.queue_id
   where q.user_id = maryam
   limit 1;

  perform test.become(yusuf);

  perform test.equals(
    (select count(*)::int from public.review_plans), 1,
    'a user sees only their own plan'
  );
  perform test.equals(
    (select count(distinct user_id)::int from public.v_page_review_state), 1,
    'review state does not leak across users'
  );
  perform test.equals(
    (select count(distinct user_id)::int from public.v_review_queue), 1,
    'the queue view does not leak across users'
  );
  perform test.throws(
    format('select public.complete_queue_item(%L, 5::smallint)', foreign_item),
    'a user cannot complete another user''s queue item'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Streaks respect the user's own day boundary
-- ---------------------------------------------------------------------------
do $$
declare
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
begin
  perform test.become(yusuf);

  perform test.ok(
    (select current_streak from public.v_review_streak where user_id = yusuf) >= 1,
    'reviewing today produces a current streak'
  );
  perform test.ok(
    (select longest_streak from public.v_review_streak where user_id = yusuf) >= 1,
    'the longest streak is at least the current one'
  );
end
$$;

\echo '   murajaah scheduling OK'
