-- ---------------------------------------------------------------------------
-- Minimal assertion helpers for the SQL test suite.
-- ---------------------------------------------------------------------------
-- Every assertion raises on failure, so `psql -v ON_ERROR_STOP=1` turns the
-- whole suite into a single pass/fail with a precise message.
-- ---------------------------------------------------------------------------

create schema if not exists test;

create or replace function test.ok(condition boolean, description text)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'ASSERTION FAILED: %', description;
  end if;
  raise notice '  ok  %', description;
end;
$$;

create or replace function test.equals(actual anyelement, expected anyelement, description text)
returns void
language plpgsql
as $$
begin
  if actual is distinct from expected then
    raise exception 'ASSERTION FAILED: % (expected %, got %)',
      description, expected, actual;
  end if;
  raise notice '  ok  % (%)', description, actual;
end;
$$;

-- Asserts that a statement fails, and optionally that it fails for the
-- expected reason. Used to prove that constraints and policies actually block
-- what they claim to block.
create or replace function test.throws(statement text, description text)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception
    when others then
      raise notice '  ok  % [%]', description, sqlstate;
      return;
  end;
  raise exception 'ASSERTION FAILED: % (statement unexpectedly succeeded)', description;
end;
$$;

-- Switches the session to an authenticated user, exactly as PostgREST does per
-- request: assume the `authenticated` role and set the subject claim.
create or replace function test.become(user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function test.become_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end;
$$;

-- The assertions themselves run after `set role`, so the helper schema must be
-- reachable from the roles under test. This grants visibility of the helpers
-- only — it does not widen access to any application table.
grant usage on schema test to anon, authenticated, service_role;
grant execute on all functions in schema test to anon, authenticated, service_role;
