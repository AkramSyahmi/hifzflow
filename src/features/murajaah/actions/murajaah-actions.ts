'use server';

import { revalidatePath } from 'next/cache';

import { getProfile } from '@/features/profile/server';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types';

import { localDateFor } from '../lib/local-date';
import { completeItemSchema, planSchema } from '../schemas/murajaah-schemas';

function fieldErrorsFrom(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  const flattened = error.flatten().fieldErrors;
  const cleaned: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flattened)) {
    if (value?.length) cleaned[key] = value;
  }
  return cleaned;
}

function revalidateMurajaah() {
  revalidatePath('/murajaah');
  revalidatePath('/dashboard');
}

/**
 * Records a completed review.
 *
 * The database function logs the session, marks the item done and advances the
 * rotation cursor in one transaction. Doing those separately would let a
 * session be recorded without the cursor moving, which replays the same page
 * tomorrow and quietly stalls the rotation.
 */
export async function completeItemAction(
  values: unknown
): Promise<ActionResult<{ itemId: string }>> {
  const parsed = completeItemSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, error: 'That review could not be recorded.' };
  }

  const { itemId, confidence, notes } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc('complete_queue_item', {
    p_item_id: itemId,
    p_confidence: confidence,
    p_notes: notes ?? null,
  });

  if (error) {
    return {
      success: false,
      error: 'Could not record that review. Try again.',
    };
  }

  revalidateMurajaah();
  return { success: true, data: { itemId } };
}

/**
 * Creates or updates the review plan.
 *
 * `manzil_cursor` is deliberately not settable here — it belongs to the
 * rotation, and letting a settings form reset it would silently replay pages
 * the user has already worked through.
 */
export async function savePlanAction(
  values: unknown
): Promise<ActionResult<{ created: boolean }>> {
  const parsed = planSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You are not signed in.' };
  }

  const { data: existing } = await supabase
    .from('review_plans')
    .select('id')
    .maybeSingle();

  const payload = {
    mode: input.mode,
    daily_pages: input.dailyPages,
    cycle_days: input.cycleDays,
    sabqi_window_days: input.sabqiWindowDays,
    sabqi_daily_pages: input.sabqiDailyPages,
    include_weak: input.includeWeak,
    weak_threshold: input.weakThreshold,
    rest_days: input.restDays,
  };

  const { error } = existing
    ? await supabase.from('review_plans').update(payload).eq('id', existing.id)
    : await supabase.from('review_plans').insert({
        ...payload,
        user_id: user.id,
        edition_id: input.editionId,
      });

  if (error) {
    return {
      success: false,
      error: 'Could not save your plan. Try again in a moment.',
    };
  }

  revalidateMurajaah();
  return { success: true, data: { created: !existing } };
}

/**
 * Clears today's queue so it regenerates on the next load.
 *
 * Needed after a plan change: the day's queue was built against the old budget
 * and would otherwise stay stale until midnight. Completed items are kept —
 * deleting a queue does not delete the review sessions it produced, so history
 * and the rotation cursor both survive.
 */
export async function regenerateTodayAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const profile = await getProfile();
  const today = localDateFor(profile?.timezone ?? 'UTC');

  const { error } = await supabase
    .from('review_queues')
    .delete()
    .eq('queue_date', today);

  if (error) {
    return { success: false, error: 'Could not rebuild today.' };
  }

  revalidateMurajaah();
  return { success: true, data: undefined };
}
