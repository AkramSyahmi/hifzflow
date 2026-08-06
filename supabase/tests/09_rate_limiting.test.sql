-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------

\echo '== Rate limiting =='

do $$
declare
  bucket text := 'sign_in:' || repeat('a', 64);
  other  text := 'sign_in:' || repeat('b', 64);
begin
  perform test.become_anon();

  -- Three attempts allowed in the window.
  perform test.ok(
    public.consume_rate_limit(bucket, 3, 60), 'first attempt is allowed'
  );
  perform test.ok(
    public.consume_rate_limit(bucket, 3, 60), 'second attempt is allowed'
  );
  perform test.ok(
    public.consume_rate_limit(bucket, 3, 60), 'third attempt is allowed'
  );
  perform test.ok(
    public.consume_rate_limit(bucket, 3, 60) = false,
    'the fourth attempt is refused'
  );
  perform test.ok(
    public.consume_rate_limit(bucket, 3, 60) = false,
    'attempts stay refused once over the limit'
  );

  -- Buckets are independent, so one address cannot lock out another.
  perform test.ok(
    public.consume_rate_limit(other, 3, 60),
    'a different bucket is unaffected'
  );
end
$$;

do $$
declare
  v_bucket text := 'reset:' || repeat('c', 64);
begin
  perform test.become_anon();

  perform test.ok(public.consume_rate_limit(v_bucket, 1, 60), 'one attempt used');
  perform test.ok(
    public.consume_rate_limit(v_bucket, 1, 60) = false, 'limit reached'
  );

  -- Backdate the window as the superuser to simulate its expiry.
  reset role;
  update public.rate_limits
     set window_start = now() - interval '10 minutes'
   where bucket = v_bucket;

  perform test.become_anon();
  perform test.ok(
    public.consume_rate_limit(v_bucket, 1, 60),
    'an expired window resets rather than accumulating'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- The table itself must be unreachable
-- ---------------------------------------------------------------------------
do $$
begin
  perform test.become_anon();

  perform test.throws(
    $q$select count(*) from public.rate_limits$q$,
    'anon cannot read the rate limit table'
  );
  perform test.throws(
    $q$insert into public.rate_limits (bucket) values ('x:' || repeat('d', 64))$q$,
    'anon cannot write the rate limit table directly'
  );

  perform test.become('11111111-1111-1111-1111-111111111111');
  perform test.throws(
    $q$select count(*) from public.rate_limits$q$,
    'an authenticated user cannot read the rate limit table either'
  );
  perform test.throws(
    $q$select public.prune_rate_limits(1)$q$,
    'pruning is not available to application roles'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Malformed input is rejected rather than silently creating a bucket
-- ---------------------------------------------------------------------------
do $$
begin
  perform test.become_anon();

  perform test.throws(
    $q$select public.consume_rate_limit('not-a-bucket', 3, 60)$q$,
    'a bucket without a hash is rejected'
  );
  perform test.throws(
    format(
      $q$select public.consume_rate_limit(%L, 0, 60)$q$,
      'sign_in:' || repeat('e', 64)
    ),
    'a zero limit is rejected'
  );
  perform test.throws(
    format(
      $q$select public.consume_rate_limit(%L, 3, 0)$q$,
      'sign_in:' || repeat('e', 64)
    ),
    'a zero window is rejected'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Pruning
-- ---------------------------------------------------------------------------
do $$
declare
  removed integer;
begin
  reset role;

  insert into public.rate_limits (bucket, window_start, attempts)
  values ('stale:' || repeat('f', 64), now() - interval '3 days', 9)
  on conflict (bucket) do update set window_start = now() - interval '3 days';

  removed := public.prune_rate_limits(24);
  perform test.ok(removed >= 1, 'stale buckets are pruned');
  perform test.ok(
    not exists (
      select 1 from public.rate_limits
       where window_start < now() - interval '24 hours'
    ),
    'nothing older than the cutoff survives'
  );
  perform test.ok(
    exists (select 1 from public.rate_limits),
    'recent buckets are left alone'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Definer functions must not be executable by PUBLIC
-- ---------------------------------------------------------------------------
-- PostgreSQL grants EXECUTE on every new function to PUBLIC. For a SECURITY
-- DEFINER function that grant is the difference between a helper and a
-- privilege escalation, and it is applied silently at creation. This assertion
-- exists because the first version of prune_rate_limits revoked from `anon` and
-- `authenticated` but not from PUBLIC, and therefore protected nothing.
--
-- consume_rate_limit is listed as an intentional exception: it must be callable
-- before a session exists, and it returns only a boolean.
-- ---------------------------------------------------------------------------
do $$
declare
  exposed text;
begin
  select string_agg(p.proname, ', ')
    into exposed
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and p.proname not in ('consume_rate_limit', 'handle_new_user')
     and has_function_privilege('public', p.oid, 'EXECUTE');

  perform test.ok(
    exposed is null,
    coalesce(
      'SECURITY DEFINER functions executable by PUBLIC: ' || exposed,
      'no SECURITY DEFINER function is executable by PUBLIC'
    )
  );
end
$$;

\echo '   rate limiting OK'
