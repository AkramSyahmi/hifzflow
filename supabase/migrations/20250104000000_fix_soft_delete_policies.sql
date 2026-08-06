-- ---------------------------------------------------------------------------
-- 0004 · Correct the soft-delete policies on profiles
-- ---------------------------------------------------------------------------
-- Migration 0001 wrote the profiles policies as
--
--   using (id = auth.uid() and deleted_at is null)
--
-- which is wrong, and wrong in a way that only surfaces when you try to use
-- it. PostgreSQL validates the *updated* row against the SELECT policy during
-- an UPDATE. The moment deleted_at is set, the resulting row no longer
-- satisfies `deleted_at is null`, so the statement is rejected with
-- "new row violates row-level security policy". The policy forbids the one
-- operation it was written to support.
--
-- The correction is a principle rather than a patch: a policy answers "is this
-- row mine", and nothing else. Lifecycle filtering belongs in views and in
-- feature queries, where it is visible and testable.
--
-- Found by the RLS test suite in supabase/tests, which is the argument for
-- having one.
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

comment on table public.profiles is
  'Application-level user record. One row per auth.users row, created by trigger. Reads must filter deleted_at explicitly; the RLS policy checks ownership only.';
