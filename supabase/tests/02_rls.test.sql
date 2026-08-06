-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- These tests exist because "RLS is enabled" is a claim, not a guarantee. Each
-- assertion below runs as a real `authenticated` session with a real subject
-- claim, the same way PostgREST executes a request.
--
-- The failure this suite is designed to catch is the quiet one: a policy that
-- is present, syntactically valid, and wrong.
-- ---------------------------------------------------------------------------

\echo '== Row Level Security =='

-- Two users, created as the superuser so the setup itself is not under test.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'aisha@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'bilal@example.test')
on conflict (id) do nothing;

-- Aisha memorises al-Fatihah (ayahs 1-7) and the start of al-Baqarah (8-20).
-- Bilal memorises Surah al-Mulk.
insert into public.memorisation_segments (user_id, ayah_range, status, memorised_on)
values
  ('11111111-1111-1111-1111-111111111111', public.ayah_range(1, 7), 'memorised', current_date - 30),
  ('11111111-1111-1111-1111-111111111111', public.ayah_range(8, 20), 'memorised', current_date - 10),
  ('22222222-2222-2222-2222-222222222222', public.ayah_range(5242, 5271), 'memorised', current_date - 5);

-- ---------------------------------------------------------------------------
-- Read isolation
-- ---------------------------------------------------------------------------
do $$
declare
  aisha uuid := '11111111-1111-1111-1111-111111111111';
  bilal uuid := '22222222-2222-2222-2222-222222222222';
begin
  perform test.become(aisha);

  perform test.equals(
    (select count(*)::int from public.memorisation_segments),
    2,
    'Aisha sees exactly her own two segments'
  );
  perform test.equals(
    (select count(*)::int from public.memorisation_segments where user_id = bilal),
    0,
    'Aisha cannot see Bilal rows even when asking for them by id'
  );

  perform test.become(bilal);

  perform test.equals(
    (select count(*)::int from public.memorisation_segments),
    1,
    'Bilal sees exactly his own segment'
  );
  perform test.equals(
    (select count(*)::int from public.memorisation_segments where user_id = aisha),
    0,
    'Bilal cannot see Aisha rows'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Views must not leak. A view created without security_invoker executes as its
-- owner and silently bypasses every policy underneath it.
-- ---------------------------------------------------------------------------
do $$
declare
  aisha uuid := '11111111-1111-1111-1111-111111111111';
  bilal uuid := '22222222-2222-2222-2222-222222222222';
begin
  perform test.become(aisha);

  perform test.equals(
    (select count(distinct user_id)::int from public.v_memorised_ayahs),
    1,
    'v_memorised_ayahs exposes only one user to Aisha'
  );
  perform test.equals(
    (select memorised_ayahs from public.v_memorisation_summary),
    20,
    'Aisha total is 20 ayahs (7 + 13)'
  );
  perform test.equals(
    (select count(*)::int from public.v_juz_progress where user_id = bilal),
    0,
    'v_juz_progress does not leak Bilal to Aisha'
  );
  perform test.equals(
    (select memorised_ayahs from public.v_surah_progress where surah_number = 1),
    7,
    'Aisha has all 7 ayahs of al-Fatihah'
  );
  perform test.equals(
    (select percent_complete from public.v_surah_progress where surah_number = 1),
    100.0::numeric,
    'al-Fatihah reports 100 percent'
  );

  perform test.become(bilal);
  perform test.equals(
    (select memorised_ayahs from public.v_memorisation_summary),
    30,
    'Bilal total is 30 ayahs'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Write isolation
-- ---------------------------------------------------------------------------
do $$
declare
  aisha uuid := '11111111-1111-1111-1111-111111111111';
  affected integer;
begin
  perform test.become(aisha);

  -- Forging another user's id on insert is the most direct attack.
  perform test.throws(
    $q$insert into public.memorisation_segments (user_id, ayah_range)
       values ('22222222-2222-2222-2222-222222222222', public.ayah_range(100, 110))$q$,
    'Aisha cannot insert a segment owned by Bilal'
  );

  -- Updating rows she cannot see must affect nothing rather than erroring:
  -- RLS filters UPDATE the same way it filters SELECT.
  update public.memorisation_segments
     set notes = 'tampered'
   where user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics affected = row_count;
  perform test.equals(affected, 0, 'Aisha updating Bilal rows affects zero rows');

  -- Reassigning ownership of her own row is blocked at the column level, so
  -- the row policy is not the only thing standing in the way.
  perform test.throws(
    $q$update public.memorisation_segments
          set user_id = '22222222-2222-2222-2222-222222222222'
        where user_id = '11111111-1111-1111-1111-111111111111'$q$,
    'Aisha cannot reassign her segment to Bilal'
  );

  -- Deletes are not granted at all; removal is a soft delete via UPDATE.
  delete from public.memorisation_segments
   where user_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics affected = row_count;
  perform test.equals(
    affected, 0, 'no DELETE policy exists, so hard deletes remove nothing'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- The overlap exclusion constraint
-- ---------------------------------------------------------------------------
do $$
declare
  aisha uuid := '11111111-1111-1111-1111-111111111111';
begin
  perform test.become(aisha);

  perform test.throws(
    $q$insert into public.memorisation_segments (user_id, ayah_range)
       values ('11111111-1111-1111-1111-111111111111', public.ayah_range(5, 12))$q$,
    'overlapping range is rejected by the exclusion constraint'
  );

  perform test.throws(
    $q$insert into public.memorisation_segments (user_id, ayah_range)
       values ('11111111-1111-1111-1111-111111111111', public.ayah_range(7, 7))$q$,
    'a single ayah already covered is rejected'
  );

  -- Adjacent, non-overlapping ranges are fine.
  insert into public.memorisation_segments (user_id, ayah_range)
  values ('11111111-1111-1111-1111-111111111111', public.ayah_range(21, 30));
  perform test.equals(
    (select count(*)::int from public.memorisation_segments),
    3,
    'an adjacent range is accepted'
  );

  -- Bilal may hold the same range as Aisha: the constraint is per user.
  perform test.become('22222222-2222-2222-2222-222222222222');
  insert into public.memorisation_segments (user_id, ayah_range)
  values ('22222222-2222-2222-2222-222222222222', public.ayah_range(1, 7));
  perform test.equals(
    (select count(*)::int from public.memorisation_segments),
    2,
    'two users may memorise the same ayahs independently'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Soft delete
-- ---------------------------------------------------------------------------
do $$
declare
  aisha uuid := '11111111-1111-1111-1111-111111111111';
  target uuid;
begin
  perform test.become(aisha);

  select id into target
    from public.memorisation_segments
   where lower(ayah_range) = 21;

  update public.memorisation_segments
     set deleted_at = now()
   where id = target;

  -- The policy checks ownership only, so the owner can still see the row on
  -- the raw table. What matters is that the application read path excludes it.
  perform test.equals(
    (select count(*)::int from public.v_memorised_ayahs
      where ayah_id between 21 and 30),
    0,
    'a soft-deleted segment disappears from the application views'
  );
  perform test.equals(
    (select count(*)::int from public.memorisation_segments
      where deleted_at is null),
    2,
    'two live segments remain'
  );

  -- The exclusion constraint ignores soft-deleted rows, so the range can be
  -- recorded again. Without the partial WHERE clause this would fail.
  insert into public.memorisation_segments (user_id, ayah_range)
  values ('11111111-1111-1111-1111-111111111111', public.ayah_range(21, 30));

  perform test.equals(
    (select count(*)::int from public.memorisation_segments
      where deleted_at is null),
    3,
    'a soft-deleted range can be re-recorded'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Custom units, where ownership is inherited through the parent set
-- ---------------------------------------------------------------------------
do $$
declare
  aisha uuid := '11111111-1111-1111-1111-111111111111';
  bilal uuid := '22222222-2222-2222-2222-222222222222';
  aisha_set uuid;
begin
  perform test.become(aisha);

  insert into public.custom_unit_sets (user_id, name, description)
  values (aisha, 'Madrasah maqra', 'Weekly divisions set by my teacher')
  returning id into aisha_set;

  insert into public.custom_units (set_id, ordinal, label, ayah_range)
  values
    (aisha_set, 1, 'Maqra 1', public.ayah_range(1, 148)),
    (aisha_set, 2, 'Maqra 2', public.ayah_range(149, 259));

  perform test.equals(
    (select count(*)::int from public.custom_units), 2, 'Aisha sees her two units'
  );

  perform test.throws(
    format(
      $q$insert into public.custom_units (set_id, ordinal, label, ayah_range)
         values (%L, 3, 'Overlapping', public.ayah_range(100, 200))$q$,
      aisha_set
    ),
    'overlapping custom units within one set are rejected'
  );

  perform test.become(bilal);

  perform test.equals(
    (select count(*)::int from public.custom_unit_sets), 0,
    'Bilal cannot see Aisha sets'
  );
  perform test.equals(
    (select count(*)::int from public.custom_units), 0,
    'Bilal cannot see units belonging to Aisha sets'
  );
  perform test.throws(
    format(
      $q$insert into public.custom_units (set_id, ordinal, label, ayah_range)
         values (%L, 9, 'Injected', public.ayah_range(300, 310))$q$,
      aisha_set
    ),
    'Bilal cannot add a unit to a set he does not own'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Anonymous access
-- ---------------------------------------------------------------------------
do $$
begin
  perform test.become_anon();

  perform test.equals(
    (select count(*)::int from public.memorisation_segments), 0,
    'anon reads no memorisation data'
  );
  perform test.equals(
    (select count(*)::int from public.v_memorised_ayahs), 0,
    'anon reads nothing through the views'
  );
  perform test.throws(
    $q$insert into public.memorisation_segments (user_id, ayah_range)
       values ('11111111-1111-1111-1111-111111111111', public.ayah_range(400, 410))$q$,
    'anon cannot write memorisation data'
  );

  -- Reference data is not granted to anon either: signing in is required.
  perform test.equals(
    (select count(*)::int from public.ayahs), 0,
    'anon cannot read reference data'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Every table in public must have RLS enabled. This catches the table someone
-- adds in a later migration and forgets to protect.
-- ---------------------------------------------------------------------------
do $$
declare
  unprotected text;
begin
  select string_agg(c.relname, ', ')
    into unprotected
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity;

  perform test.ok(
    unprotected is null,
    coalesce('tables without RLS: ' || unprotected, 'every public table has RLS enabled')
  );
end
$$;

-- Views must all be security_invoker, or they bypass the policies above.
do $$
declare
  leaky text;
begin
  select string_agg(c.relname, ', ')
    into leaky
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'v'
     and coalesce(
           (select option_value
              from pg_options_to_table(c.reloptions)
             where option_name = 'security_invoker'),
           'false'
         ) <> 'true';

  perform test.ok(
    leaky is null,
    coalesce('views without security_invoker: ' || leaky,
             'every public view is security_invoker')
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Soft delete must actually be possible. This is the assertion that caught the
-- original policy bug: a SELECT policy containing `deleted_at is null` rejects
-- the very UPDATE that sets it.
-- ---------------------------------------------------------------------------
do $$
declare
  aisha uuid := '11111111-1111-1111-1111-111111111111';
  affected integer;
begin
  perform test.become(aisha);

  update public.memorisation_segments
     set deleted_at = now()
   where deleted_at is null
     and lower(ayah_range) = 8;
  get diagnostics affected = row_count;
  perform test.equals(affected, 1, 'the owner can soft delete their own segment');

  update public.memorisation_segments
     set deleted_at = null
   where lower(ayah_range) = 8;
  get diagnostics affected = row_count;
  perform test.equals(affected, 1, 'the owner can restore a soft-deleted segment');
end
$$;

-- Created as the superuser, because profiles has no INSERT policy by design:
-- rows are provisioned solely by the signup trigger, so a client cannot
-- manufacture one. That constraint is itself asserted below.
insert into public.profiles (id, display_name)
values ('11111111-1111-1111-1111-111111111111', 'Aisha')
on conflict (id) do nothing;

do $$
declare
  aisha uuid := '11111111-1111-1111-1111-111111111111';
  affected integer;
begin
  perform test.become(aisha);

  perform test.throws(
    $q$insert into public.profiles (id, display_name)
       values ('33333333-3333-3333-3333-333333333333', 'Forged')$q$,
    'a client cannot create a profile row directly'
  );

  update public.profiles set deleted_at = now() where id = aisha;
  get diagnostics affected = row_count;
  perform test.equals(affected, 1, 'a profile can be soft deleted by its owner');

  update public.profiles set deleted_at = null where id = aisha;
  get diagnostics affected = row_count;
  perform test.equals(affected, 1, 'a profile can be restored');
end
$$;

\echo '   row level security OK'

-- ---------------------------------------------------------------------------
-- Column privileges
-- ---------------------------------------------------------------------------
-- These assertions exist because the original form of this protection —
-- `revoke update (col) ... from authenticated` — silently did nothing. A
-- column-level REVOKE cannot subtract from a table-level privilege, and
-- `authenticated` holds table-level UPDATE. The protection was claimed in two
-- milestones before anyone tried to defeat it.
-- ---------------------------------------------------------------------------
do $$
declare
  aisha uuid := '11111111-1111-1111-1111-111111111111';
begin
  perform test.become(aisha);

  perform test.throws(
    $q$update public.profiles set created_at = now() - interval '1 year'
        where id = '11111111-1111-1111-1111-111111111111'$q$,
    'created_at on profiles cannot be rewritten'
  );

  perform test.throws(
    $q$update public.memorisation_segments set created_at = now()
        where user_id = '11111111-1111-1111-1111-111111111111'$q$,
    'created_at on memorisation_segments cannot be rewritten'
  );

  perform test.throws(
    $q$update public.memorisation_segments set updated_at = now() - interval '1 day'
        where user_id = '11111111-1111-1111-1111-111111111111'$q$,
    'updated_at cannot be forged'
  );

  -- The columns that should still be writable must remain so.
  update public.profiles set display_name = 'Aisha R.' where id = aisha;
  perform test.equals(
    (select display_name from public.profiles where id = aisha),
    'Aisha R.',
    'writable columns are still writable'
  );
end
$$;
