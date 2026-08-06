-- ---------------------------------------------------------------------------
-- 0013 · Rate limiting
-- ---------------------------------------------------------------------------
-- Server Actions have no rate limiting of their own, and the auth actions are
-- reachable before a session exists — which is precisely where brute force and
-- credential stuffing arrive.
--
-- Implemented in PostgreSQL rather than with Redis. The reasoning:
--
--   * An in-memory counter is useless. Serverless instances do not share state,
--     so the limit becomes "N attempts per instance", which is no limit at all.
--   * Redis (Upstash and similar) works, but adds a service, two secrets and a
--     second thing that can be down. For a handful of auth endpoints the write
--     volume does not justify it.
--   * The database is already here, already transactional, and already the
--     thing an attacker is trying to reach.
--
-- Buckets are opaque hashes computed by the application, so this table never
-- holds an email address or an IP. That matters because it is one of the very
-- few tables the anonymous role can write to.
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  bucket       text        primary key,
  window_start timestamptz not null default now(),
  attempts     integer     not null default 0,

  constraint rate_limits_bucket_shape
    check (bucket ~ '^[a-z_]+:[0-9a-f]{64}$'),
  constraint rate_limits_attempts_nonnegative check (attempts >= 0)
);

comment on table public.rate_limits is
  'Fixed-window attempt counters for pre-auth endpoints. Buckets are opaque hashes; no PII is stored.';
comment on column public.rate_limits.bucket is
  'scope:sha256 — the hash is computed by the application so this table never sees an email or IP.';

create index rate_limits_window_idx on public.rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- consume_rate_limit
-- ---------------------------------------------------------------------------
-- Increments a bucket and reports whether the caller is still under the limit.
--
-- A fixed window rather than a sliding one. A sliding window is fairer at the
-- boundary, but needs a row per attempt instead of a counter, and for
-- protecting a sign-in form the difference is a burst of at most 2N over two
-- adjacent windows — acceptable, and far cheaper.
--
-- SECURITY DEFINER because the anonymous role must be able to call it without
-- being granted write access to the table itself. It is safe for the usual
-- reason: the only thing a caller can influence is which bucket is incremented,
-- and no bucket's contents are ever returned.
--
-- The upsert is a single statement, so two concurrent attempts cannot both read
-- the same count and each believe they are the first.
-- ---------------------------------------------------------------------------
create or replace function public.consume_rate_limit(
  p_bucket          text,
  p_max_attempts    integer,
  p_window_seconds  integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
begin
  if p_bucket is null or p_bucket !~ '^[a-z_]+:[0-9a-f]{64}$' then
    raise exception 'malformed rate limit bucket' using errcode = '22023';
  end if;

  if p_max_attempts < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;

  insert into public.rate_limits (bucket, window_start, attempts)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set
      -- An expired window resets rather than accumulating, which is what makes
      -- this a window and not a lifetime cap.
      window_start = case
        when public.rate_limits.window_start
             < now() - make_interval(secs => p_window_seconds)
          then now()
        else public.rate_limits.window_start
      end,
      attempts = case
        when public.rate_limits.window_start
             < now() - make_interval(secs => p_window_seconds)
          then 1
        else public.rate_limits.attempts + 1
      end
  returning attempts into v_attempts;

  return v_attempts <= p_max_attempts;
end;
$$;

comment on function public.consume_rate_limit is
  'Increments a bucket and returns whether the caller is within the limit. Fixed window.';

-- ---------------------------------------------------------------------------
-- prune_rate_limits
-- ---------------------------------------------------------------------------
-- Housekeeping. Without it the table grows one row per distinct bucket forever,
-- and buckets include a per-address component, so the row count tracks the
-- number of addresses ever tried rather than the number of real users.
-- ---------------------------------------------------------------------------
create or replace function public.prune_rate_limits(
  p_older_than_hours integer default 24
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits
   where window_start < now() - make_interval(hours => p_older_than_hours);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.prune_rate_limits is
  'Deletes stale rate limit buckets. Called by the scheduled keepalive job.';

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
-- RLS is enabled with no policies at all. Nothing can read or write the table
-- directly; the only route in is through the definer function above, which
-- returns a boolean and never the counter itself. An attacker therefore cannot
-- probe how close they are to a limit.
-- ---------------------------------------------------------------------------
alter table public.rate_limits enable row level security;

revoke all on table public.rate_limits from anon, authenticated;

-- PostgreSQL grants EXECUTE on every new function to PUBLIC. Revoking from
-- `anon` and `authenticated` alone leaves that grant in place and does nothing,
-- the same way a column-level UPDATE revoke does nothing against a table-level
-- grant. Both revokes have to name PUBLIC.
revoke all on function public.consume_rate_limit(text, integer, integer)
  from public;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to anon, authenticated;

revoke all on function public.prune_rate_limits(integer) from public;
grant execute on function public.prune_rate_limits(integer) to service_role;
