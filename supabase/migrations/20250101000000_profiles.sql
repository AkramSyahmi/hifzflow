-- ---------------------------------------------------------------------------
-- 0001 · Profiles
-- ---------------------------------------------------------------------------
-- Establishes the shared conventions every later table follows:
--   * updated_at maintained by trigger, never by the client
--   * deleted_at soft delete, never a hard DELETE from the application
--   * RLS enabled with an explicit deny-by-default posture
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Shared trigger function: keep updated_at honest.
-- Reused by every table with an updated_at column.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Sets updated_at to now() on UPDATE. Attached to every table with that column.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- One row per auth user, created automatically by trigger on signup.
--
-- timezone is not decoration. Streak calculation, "today's murajaah" and daily
-- targets all resolve against the user's local day boundary. Storing UTC and
-- assuming it is a common source of streaks appearing to reset overnight.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid        primary key references auth.users (id) on delete cascade,
  display_name  text,
  avatar_url    text,
  timezone      text        not null default 'Asia/Kuala_Lumpur',
  locale        text        not null default 'en',
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,

  constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 60),

  constraint profiles_locale_supported
    check (locale in ('en', 'ms')),

  -- IANA identifiers are at minimum "Area/Location" or a small set of bare
  -- names such as UTC. Full validation against pg_timezone_names is not
  -- possible in a CHECK constraint (the view is not IMMUTABLE), so the
  -- authoritative check happens at the application boundary via Zod.
  constraint profiles_timezone_shape
    check (char_length(timezone) between 3 and 64 and timezone !~ '\s'),

  constraint profiles_avatar_url_scheme
    check (avatar_url is null or avatar_url ~ '^https://')
);

comment on table public.profiles is
  'Application-level user record. One row per auth.users row, created by trigger.';
comment on column public.profiles.timezone is
  'IANA timezone. Drives every local-day boundary: streaks, daily targets, review queues.';
comment on column public.profiles.locale is
  'UI language. Populated at signup, editable in settings.';
comment on column public.profiles.onboarded_at is
  'Set when the user completes first-run setup. Null means onboarding is still pending.';
comment on column public.profiles.deleted_at is
  'Soft delete. Rows are never removed; RLS filters them out.';

-- Partial index: every read path filters to live rows, so the index should too.
create index profiles_active_idx
  on public.profiles (id)
  where deleted_at is null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Provision a profile whenever an auth user is created.
-- ---------------------------------------------------------------------------
-- Runs as SECURITY DEFINER because the inserting role is the auth service,
-- which has no privileges in the public schema. search_path is pinned to
-- prevent search-path hijacking, which is the standard attack against
-- definer functions.
--
-- Metadata keys come from the signUp options and are all optional: OAuth
-- providers supply their own shapes, so every lookup falls back.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_timezone text := nullif(btrim(new.raw_user_meta_data ->> 'timezone'), '');
  meta_locale   text := nullif(btrim(new.raw_user_meta_data ->> 'locale'), '');
  meta_name     text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), '')
  );
  meta_avatar   text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'picture'), '')
  );
begin
  insert into public.profiles (id, display_name, avatar_url, timezone, locale)
  values (
    new.id,
    left(meta_name, 60),
    case when meta_avatar ~ '^https://' then meta_avatar end,
    coalesce(meta_timezone, 'Asia/Kuala_Lumpur'),
    case when meta_locale in ('en', 'ms') then meta_locale else 'en' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the public.profiles row for a new auth user, seeding timezone and locale from signup metadata.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Deny by default. Every policy below is scoped to the authenticated role and
-- to the caller's own row; the anon role is granted nothing.
--
-- INSERT is deliberately absent: profiles are created only by the signup
-- trigger, so a client cannot manufacture one. DELETE is deliberately absent:
-- deletion is a soft delete performed through an UPDATE.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) and deleted_at is null);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) and deleted_at is null)
  with check (id = (select auth.uid()));

-- Columns a user must never set on themselves. Revoking at the column level
-- means a compromised client cannot escalate by writing to them, even though
-- the row-level policy would otherwise permit the UPDATE.
revoke update (id, created_at, updated_at) on public.profiles from authenticated;
