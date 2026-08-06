-- ---------------------------------------------------------------------------
-- Preferences, export and account deletion
-- ---------------------------------------------------------------------------

\echo '== Account =='

insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'sumayyah@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, display_name, timezone)
values ('88888888-8888-8888-8888-888888888888', 'Sumayyah', 'Asia/Kuala_Lumpur')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Reminder preferences
-- ---------------------------------------------------------------------------
do $$
declare
  sumayyah uuid := '88888888-8888-8888-8888-888888888888';
begin
  perform test.become(sumayyah);

  perform test.ok(
    (select reminder_enabled from public.profiles where id = sumayyah) = false,
    'reminders are off by default'
  );

  update public.profiles
     set reminder_enabled = true,
         reminder_time = '05:15',
         reminder_days = array[1, 2, 3, 4, 5]::smallint[]
   where id = sumayyah;

  perform test.equals(
    (select reminder_time::text from public.profiles where id = sumayyah),
    '05:15:00',
    'a reminder time can be set'
  );
  perform test.equals(
    (select array_length(reminder_days, 1) from public.profiles where id = sumayyah),
    5,
    'reminder days can be restricted to weekdays'
  );

  perform test.throws(
    $q$update public.profiles set reminder_days = array[9]::smallint[]
        where id = '88888888-8888-8888-8888-888888888888'$q$,
    'an invalid weekday is rejected'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Export
-- ---------------------------------------------------------------------------
do $$
declare
  sumayyah uuid := '88888888-8888-8888-8888-888888888888';
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
  payload jsonb;
begin
  perform test.become(sumayyah);

  perform public.record_memorisation(1, 7, 'memorised', 4::smallint, current_date - 2, 'first surah');

  payload := public.export_my_data();

  perform test.ok(payload ? 'profile', 'the export includes the profile');
  perform test.ok(
    payload ? 'memorisation_segments', 'the export includes memorisation'
  );
  perform test.ok(payload ? 'review_sessions', 'the export includes reviews');
  perform test.ok(payload ? 'goals', 'the export includes goals');
  perform test.equals(
    (payload -> 'format_version')::int, 1, 'the export is versioned'
  );

  perform test.equals(
    jsonb_array_length(payload -> 'memorisation_segments'), 1,
    'the export carries the recorded segment'
  );
  perform test.equals(
    (payload -> 'memorisation_segments' -> 0 ->> 'first_ayah')::int, 1,
    'ranges are exported as inclusive ayah numbers'
  );
  perform test.equals(
    (payload -> 'memorisation_segments' -> 0 ->> 'last_ayah')::int, 7,
    'the upper bound is converted from the half-open form'
  );
  perform test.equals(
    payload -> 'memorisation_segments' -> 0 ->> 'notes', 'first surah',
    'notes survive the export'
  );

  -- The export must never reach another user's records.
  perform test.become(yusuf);
  perform test.ok(
    jsonb_array_length(public.export_my_data() -> 'memorisation_segments')
      <> jsonb_array_length(payload -> 'memorisation_segments')
      or (public.export_my_data() -> 'profile' ->> 'display_name') <> 'Sumayyah',
    'the export is scoped to the caller'
  );
  perform test.ok(
    (public.export_my_data() -> 'profile' ->> 'display_name') is distinct from 'Sumayyah',
    'one user''s export does not contain another user''s profile'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Deletion cascades through every table
-- ---------------------------------------------------------------------------
do $$
declare
  sumayyah uuid := '88888888-8888-8888-8888-888888888888';
  remaining integer;
begin
  perform test.become(sumayyah);

  -- Give the account something in every table before deleting it.
  insert into public.review_plans (user_id, edition_id) values (sumayyah, 1);
  perform public.ensure_review_queue(current_date);
  insert into public.goals (user_id, name, scope_type, ayah_range, target_date)
  values (sumayyah, 'Test', 'quran', int4range(1, 6237), current_date + 30);
  insert into public.custom_unit_sets (user_id, name) values (sumayyah, 'Maqra');

  perform public.delete_my_account();

  -- Read back as the superuser: the rows should be gone entirely, not hidden.
  reset role;

  select
    (select count(*) from public.profiles where id = sumayyah)
    + (select count(*) from public.memorisation_segments where user_id = sumayyah)
    + (select count(*) from public.review_plans where user_id = sumayyah)
    + (select count(*) from public.review_queues where user_id = sumayyah)
    + (select count(*) from public.goals where user_id = sumayyah)
    + (select count(*) from public.custom_unit_sets where user_id = sumayyah)
    + (select count(*) from auth.users where id = sumayyah)
    into remaining;

  perform test.equals(
    remaining, 0,
    'deleting the account removes every row it owned, in every table'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Deletion cannot be aimed at anyone else
-- ---------------------------------------------------------------------------
do $$
declare
  yusuf uuid := '44444444-4444-4444-4444-444444444444';
begin
  -- The function takes no arguments, so there is no parameter through which a
  -- caller could name another user. Asserted by confirming that no overload
  -- accepting an argument exists — if one were ever added, this fails.
  perform test.equals(
    (select count(*)::int
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'delete_my_account'
        and p.pronargs > 0),
    0,
    'delete_my_account accepts no arguments, so it cannot target another user'
  );

  perform test.ok(
    exists (
      select 1 from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'delete_my_account'
        and p.prosecdef
        and p.proconfig is not null
    ),
    'delete_my_account is SECURITY DEFINER with a pinned search_path'
  );

  -- Unauthenticated callers are refused.
  perform test.become_anon();
  perform test.throws(
    $q$select public.delete_my_account()$q$,
    'an unauthenticated caller cannot delete anything'
  );

  perform test.become(yusuf);
  perform test.ok(
    exists (select 1 from auth.users where id = yusuf),
    'another user survived the deletion above'
  );
end
$$;

\echo '   account OK'
