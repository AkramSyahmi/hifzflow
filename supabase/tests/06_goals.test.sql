-- ---------------------------------------------------------------------------
-- Goals
-- ---------------------------------------------------------------------------
-- The arithmetic here is what a user makes decisions on, so every rate and
-- projection is asserted against known inputs rather than eyeballed.
-- ---------------------------------------------------------------------------

\echo '== Goals =='

insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666', 'zainab@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, display_name, timezone)
values ('66666666-6666-6666-6666-666666666666', 'Zainab', 'Asia/Kuala_Lumpur')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Scope resolution
-- ---------------------------------------------------------------------------
do $$
begin
  perform test.become('66666666-6666-6666-6666-666666666666');

  perform test.equals(
    public.ayah_range_length(public.goal_scope_range('quran', null)),
    6236,
    'the whole-Quran scope covers every ayah'
  );

  -- Juz 30 begins at an-Naba and runs to the end.
  perform test.equals(
    upper(public.goal_scope_range('juz', 30)) - 1,
    6236,
    'juz 30 ends at the last ayah'
  );
  perform test.equals(
    (select surah_number::int from public.ayahs
      where id = lower(public.goal_scope_range('juz', 30))),
    78,
    'juz 30 opens at an-Naba'
  );

  -- Surah al-Mulk is 30 ayahs.
  perform test.equals(
    public.ayah_range_length(public.goal_scope_range('surah', 67)),
    30,
    'a surah scope matches its ayah count'
  );

  -- A span of surahs.
  perform test.equals(
    public.ayah_range_length(public.goal_scope_range('surah', 1, 2)),
    293,
    'a multi-surah scope sums their ayahs'
  );

  perform test.ok(
    not isempty(public.goal_scope_range('pages', 1, 10, 1::smallint)),
    'a page scope resolves to a range'
  );

  perform test.throws(
    $q$select public.goal_scope_range('juz', 99)$q$,
    'an out-of-range juz is rejected'
  );
  perform test.throws(
    $q$select public.goal_scope_range('nonsense', 1)$q$,
    'an unknown scope type is rejected'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Baseline and required pace
-- ---------------------------------------------------------------------------
do $$
declare
  zainab uuid := '66666666-6666-6666-6666-666666666666';
  goal_range int4range;
  goal_id uuid;
  scope_len integer;
begin
  perform test.become(zainab);

  goal_range := public.goal_scope_range('surah', 67);
  scope_len := public.ayah_range_length(goal_range);

  -- Ten of the thirty ayahs are already known before the goal is set.
  perform public.record_memorisation(
    lower(goal_range), lower(goal_range) + 9, 'memorised', null, current_date - 40
  );

  insert into public.goals (
    user_id, name, scope_type, scope_from, ayah_range,
    started_on, target_date, baseline_ayahs
  )
  values (
    zainab, 'Al-Mulk', 'surah', 67, goal_range,
    -- Started ten days ago so the overdue case below can move the target date
    -- backwards without tripping the target-after-start constraint.
    current_date - 10, current_date + 20, 10
  )
  returning id into goal_id;

  perform test.equals(
    (select memorised_ayahs from public.v_goal_progress where id = goal_id),
    10,
    'existing memorisation counts toward the goal'
  );
  perform test.equals(
    (select remaining_ayahs from public.v_goal_progress where id = goal_id),
    20,
    'remaining is the scope minus what is known'
  );

  -- Twenty ayahs over twenty days is one a day. Computed over what remains,
  -- not over the whole scope, which would wrongly demand 1.5.
  perform test.equals(
    (select required_ayahs_per_day from public.v_goal_progress where id = goal_id),
    1.0::numeric,
    'required pace is computed over what remains, not the whole scope'
  );

  perform test.equals(
    (select scope_ayahs from public.v_goal_progress where id = goal_id),
    scope_len,
    'scope size matches the resolved range'
  );
  perform test.equals(
    (select percent_complete from public.v_goal_progress where id = goal_id),
    33.3::numeric,
    'percentage is of the whole scope'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Observed pace, projection and state
-- ---------------------------------------------------------------------------
do $$
declare
  zainab uuid := '66666666-6666-6666-6666-666666666666';
  goal_id uuid;
  goal_range int4range;
begin
  perform test.become(zainab);

  select id, ayah_range into goal_id, goal_range
    from public.goals where user_id = zainab limit 1;

  -- Nothing recorded inside the fortnight window yet.
  perform test.equals(
    (select recent_ayahs_per_day from public.v_goal_progress where id = goal_id),
    0.0::numeric,
    'observed pace is zero before any recent work'
  );
  perform test.ok(
    (select projected_completion_date from public.v_goal_progress where id = goal_id)
      is null,
    'no completion date is projected at zero pace'
  );
  perform test.equals(
    (select state from public.v_goal_progress where id = goal_id),
    'stalled',
    'a goal with no recent work reads as stalled, not on track'
  );

  -- Record fourteen ayahs across the window: one a day observed.
  perform public.record_memorisation(
    lower(goal_range) + 10, lower(goal_range) + 23, 'memorised', null, current_date - 5
  );

  perform test.equals(
    (select recent_ayahs_per_day from public.v_goal_progress where id = goal_id),
    1.0::numeric,
    'observed pace reflects what was actually recorded'
  );
  perform test.equals(
    (select remaining_ayahs from public.v_goal_progress where id = goal_id),
    6,
    'remaining fell by the amount recorded'
  );
  perform test.ok(
    (select projected_completion_date from public.v_goal_progress where id = goal_id)
      = current_date + 6,
    'projection divides what remains by observed pace'
  );
  perform test.equals(
    (select state from public.v_goal_progress where id = goal_id),
    'on_track',
    'six ayahs at one a day inside twenty days is on track'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Behind, overdue and complete
-- ---------------------------------------------------------------------------
do $$
declare
  zainab uuid := '66666666-6666-6666-6666-666666666666';
  goal_id uuid;
begin
  perform test.become(zainab);
  select id into goal_id from public.goals where user_id = zainab limit 1;

  -- Pull the deadline in so the same pace no longer reaches it.
  update public.goals set target_date = current_date + 2 where id = goal_id;
  perform test.equals(
    (select state from public.v_goal_progress where id = goal_id),
    'behind',
    'the same pace against a nearer deadline reads as behind'
  );
  perform test.equals(
    (select required_ayahs_per_day from public.v_goal_progress where id = goal_id),
    3.0::numeric,
    'required pace rises as the deadline approaches'
  );

  -- A date in the past is overdue, and no rate is reported for it.
  update public.goals set target_date = current_date - 1 where id = goal_id;
  perform test.equals(
    (select state from public.v_goal_progress where id = goal_id),
    'overdue',
    'a passed target date reads as overdue'
  );
  perform test.ok(
    (select required_ayahs_per_day from public.v_goal_progress where id = goal_id)
      is null,
    'no required pace is reported once the date has passed'
  );

  -- Finishing the scope reads as complete regardless of the date.
  perform public.record_memorisation(
    lower((select ayah_range from public.goals where id = goal_id)),
    upper((select ayah_range from public.goals where id = goal_id)) - 1
  );
  perform test.equals(
    (select state from public.v_goal_progress where id = goal_id),
    'complete',
    'a fully memorised scope reads as complete even when overdue'
  );
  perform test.equals(
    (select percent_complete from public.v_goal_progress where id = goal_id),
    100.0::numeric,
    'a finished goal reports 100 percent'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Isolation and constraints
-- ---------------------------------------------------------------------------
do $$
declare
  zainab uuid := '66666666-6666-6666-6666-666666666666';
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
begin
  perform test.become(yusuf);
  perform test.equals(
    (select count(*)::int from public.goals), 0,
    'a user cannot see another user''s goals'
  );
  perform test.equals(
    (select count(*)::int from public.v_goal_progress), 0,
    'goal progress does not leak across users'
  );
  perform test.throws(
    format(
      $q$insert into public.goals (user_id, name, scope_type, ayah_range, target_date)
         values (%L, 'Forged', 'quran', int4range(1, 6237), current_date + 30)$q$,
      zainab
    ),
    'a user cannot create a goal owned by someone else'
  );

  perform test.become(zainab);
  perform test.throws(
    $q$update public.goals set baseline_ayahs = 0 where user_id = '66666666-6666-6666-6666-666666666666'$q$,
    'the baseline cannot be rewritten after creation'
  );
  perform test.throws(
    $q$insert into public.goals (user_id, name, scope_type, ayah_range, started_on, target_date)
       values ('66666666-6666-6666-6666-666666666666', 'Backwards', 'quran',
               int4range(1, 6237), current_date, current_date - 5)$q$,
    'a target date before the start date is rejected'
  );
end
$$;

\echo '   goals OK'
