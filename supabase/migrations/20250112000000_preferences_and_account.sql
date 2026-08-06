-- ---------------------------------------------------------------------------
-- 0012 · Preferences, export and account deletion
-- ---------------------------------------------------------------------------
-- Theme is deliberately absent from this migration. next-themes persists it to
-- localStorage and applies it before first paint, which is the only way to
-- avoid a flash of the wrong theme. Storing it in the database would mean a
-- round trip before the correct theme is known, so the flash returns and the
-- only thing gained is cross-device sync of a setting people set once per
-- device anyway. Not a good trade.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column reminder_enabled boolean not null default false,
  add column reminder_time    time    not null default '05:30',
  add column reminder_days    smallint[] not null default '{0,1,2,3,4,5,6}';

comment on column public.profiles.reminder_enabled is
  'Whether the user wants a daily murajaah reminder. Delivery arrives with push notifications.';
comment on column public.profiles.reminder_time is
  'Local time for the daily reminder, interpreted in profiles.timezone.';

alter table public.profiles
  add constraint profiles_reminder_days_valid
    check (reminder_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

-- The reminder columns are user-editable; the rest of the grant is unchanged.
revoke update on public.profiles from authenticated;
grant update (
  display_name, avatar_url, timezone, locale, onboarded_at, deleted_at,
  reminder_enabled, reminder_time, reminder_days
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- export_my_data
-- ---------------------------------------------------------------------------
-- Everything the application holds about the caller, as one JSON document.
--
-- SECURITY INVOKER, so RLS scopes every subquery to the caller and the function
-- cannot become a way to read someone else's records. Reference data is
-- excluded: it is the same 6,236 rows for everyone and would swamp the export
-- without telling the user anything about themselves.
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'format_version', 1,
    'profile', (
      select to_jsonb(p) - 'id'
        from public.profiles p
       where p.id = v_caller
    ),
    'memorisation_segments', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'first_ayah', lower(s.ayah_range),
                 'last_ayah', upper(s.ayah_range) - 1,
                 'status', s.status,
                 'confidence', s.confidence,
                 'memorised_on', s.memorised_on,
                 'notes', s.notes,
                 'created_at', s.created_at
               ) order by lower(s.ayah_range)
             )
        from public.memorisation_segments s
       where s.deleted_at is null
    ), '[]'::jsonb),
    'review_sessions', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'first_ayah', lower(r.ayah_range),
                 'last_ayah', upper(r.ayah_range) - 1,
                 'reviewed_on', r.reviewed_on,
                 'confidence', r.confidence,
                 'tier', r.tier,
                 'notes', r.notes
               ) order by r.reviewed_on, r.created_at
             )
        from public.review_sessions r
    ), '[]'::jsonb),
    'review_plan', (
      select to_jsonb(rp) - 'id' - 'user_id'
        from public.review_plans rp
    ),
    'goals', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'name', g.name,
                 'scope_type', g.scope_type,
                 'scope_from', g.scope_from,
                 'scope_to', g.scope_to,
                 'first_ayah', lower(g.ayah_range),
                 'last_ayah', upper(g.ayah_range) - 1,
                 'started_on', g.started_on,
                 'target_date', g.target_date,
                 'baseline_ayahs', g.baseline_ayahs,
                 'status', g.status
               ) order by g.started_on
             )
        from public.goals g
       where g.deleted_at is null
    ), '[]'::jsonb),
    'custom_unit_sets', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'name', cs.name,
                 'description', cs.description,
                 'units', coalesce((
                   select jsonb_agg(
                            jsonb_build_object(
                              'ordinal', cu.ordinal,
                              'label', cu.label,
                              'first_ayah', lower(cu.ayah_range),
                              'last_ayah', upper(cu.ayah_range) - 1
                            ) order by cu.ordinal
                          )
                     from public.custom_units cu
                    where cu.set_id = cs.id
                 ), '[]'::jsonb)
               ) order by cs.name
             )
        from public.custom_unit_sets cs
       where cs.deleted_at is null
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.export_my_data() is
  'Everything the application holds about the caller, as JSON. Reference data excluded.';

-- ---------------------------------------------------------------------------
-- delete_my_account
-- ---------------------------------------------------------------------------
-- Real deletion, not a soft delete.
--
-- Every user table references auth.users with ON DELETE CASCADE, so removing
-- the auth row removes everything: profile, segments, reviews, queues, plans,
-- goals and custom units. That is what someone asking to be deleted is asking
-- for, and offering a soft delete instead would be misrepresenting it.
--
-- SECURITY DEFINER is required because the auth schema is not writable by
-- application roles. It is safe here for a specific reason: the function takes
-- no arguments and deletes exactly `auth.uid()`. There is no parameter through
-- which a caller could name a different user, which is the property that makes
-- a definer function acceptable. search_path is pinned, as it must be on any
-- definer function.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  delete from auth.users where id = v_caller;
end;
$$;

comment on function public.delete_my_account() is
  'Permanently deletes the calling user and, by cascade, all of their data. Takes no arguments by design.';

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
