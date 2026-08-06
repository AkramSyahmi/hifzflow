-- ---------------------------------------------------------------------------
-- 0010 · Correct the column-level privilege grants
-- ---------------------------------------------------------------------------
-- Earlier migrations wrote column protection as, for example:
--
--   revoke update (id, user_id, created_at, updated_at)
--     on public.memorisation_segments from authenticated;
--
-- That is a no-op. In PostgreSQL, a column-level REVOKE cannot subtract from a
-- table-level privilege — and `authenticated` holds table-level UPDATE through
-- Supabase's default grants. The broad privilege stays in force and the narrow
-- revoke has nothing to act against, so every one of those statements has been
-- inert since it was written.
--
-- The form that actually holds is to revoke the table privilege and grant back
-- only the writable columns. Found by asserting the protection rather than
-- assuming it: the test tried to rewrite a frozen column and succeeded.
--
-- Row policies were never affected — a user could not reach another user's
-- rows at any point. What was missing is the second layer that stops a
-- compromised client rewriting ownership or audit columns on its own rows.
-- ---------------------------------------------------------------------------

-- profiles -------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, timezone, locale, onboarded_at, deleted_at)
  on public.profiles to authenticated;

-- memorisation_segments ------------------------------------------------------
revoke update on public.memorisation_segments from authenticated;
grant update (ayah_range, status, confidence, memorised_on, notes, deleted_at)
  on public.memorisation_segments to authenticated;

-- custom_unit_sets -----------------------------------------------------------
revoke update on public.custom_unit_sets from authenticated;
grant update (name, description, deleted_at)
  on public.custom_unit_sets to authenticated;

-- custom_units ---------------------------------------------------------------
revoke update on public.custom_units from authenticated;
grant update (ordinal, label, ayah_range)
  on public.custom_units to authenticated;

-- review_plans ---------------------------------------------------------------
-- manzil_cursor is granted because complete_queue_item() is SECURITY INVOKER
-- and therefore advances the rotation as the calling user. Keeping the
-- function invoker-rights preserves RLS, which matters more than hiding this
-- column; nothing in the application writes it directly.
revoke update on public.review_plans from authenticated;
grant update (
  mode, daily_pages, cycle_days, sabqi_window_days, sabqi_daily_pages,
  include_weak, weak_threshold, manzil_cursor, rest_days
) on public.review_plans to authenticated;

-- review_sessions ------------------------------------------------------------
revoke update on public.review_sessions from authenticated;
grant update (confidence, notes, duration_seconds)
  on public.review_sessions to authenticated;

-- review_queue_items ---------------------------------------------------------
-- Written by complete_queue_item(), again as the calling user.
revoke update on public.review_queue_items from authenticated;
grant update (completed_at, confidence, session_id)
  on public.review_queue_items to authenticated;
