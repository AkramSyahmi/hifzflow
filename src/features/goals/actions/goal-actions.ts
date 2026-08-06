'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types';

import {
  createGoalSchema,
  goalStatusSchema,
  updateGoalSchema,
} from '../schemas/goal-schemas';

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

function revalidateGoals() {
  revalidatePath('/goals');
  revalidatePath('/dashboard');
}

/**
 * Creates a goal.
 *
 * The scope is resolved to an ayah range by the database rather than here, so
 * goals describe a portion of the Quran the same way everything else does. The
 * baseline — how much of the scope is already memorised — is captured at
 * creation and frozen, so required pace is computed over what genuinely
 * remains rather than over ground already covered.
 */
export async function createGoalAction(
  values: unknown
): Promise<ActionResult<{ goalId: string }>> {
  const parsed = createGoalSchema.safeParse(values);

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

  if (!user) return { success: false, error: 'You are not signed in.' };

  const { data: range, error: scopeError } = await supabase.rpc(
    'goal_scope_range',
    {
      p_scope_type: input.scopeType,
      p_scope_from:
        input.scopeType === 'quran' ? null : (input.scopeFrom ?? null),
      p_scope_to: input.scopeTo ?? null,
      p_edition_id: input.editionId,
    }
  );

  if (scopeError || !range) {
    return { success: false, error: 'That scope could not be resolved.' };
  }

  // Count what is already memorised inside the scope. Done as a separate read
  // rather than in the insert so the value is frozen at this moment.
  const { count } = await supabase
    .from('v_memorised_ayahs')
    .select('ayah_id', { count: 'exact', head: true })
    .filter('ayah_id', 'gte', Number(/\[(\d+),/.exec(range)?.[1] ?? 1))
    .filter('ayah_id', 'lt', Number(/,(\d+)\)/.exec(range)?.[1] ?? 6237));

  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: user.id,
      name: input.name,
      scope_type: input.scopeType,
      scope_from:
        input.scopeType === 'quran' ? null : (input.scopeFrom ?? null),
      scope_to: input.scopeTo ?? null,
      ayah_range: range,
      target_date: input.targetDate,
      baseline_ayahs: count ?? 0,
    })
    .select('id')
    .single();

  if (error) {
    return {
      success: false,
      error: 'Could not create that goal. Try again in a moment.',
    };
  }

  revalidateGoals();
  return { success: true, data: { goalId: data.id } };
}

export async function updateGoalAction(values: unknown): Promise<ActionResult> {
  const parsed = updateGoalSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const { goalId, name, targetDate } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from('goals')
    .update({ name, target_date: targetDate })
    .eq('id', goalId);

  if (error) {
    return { success: false, error: 'Could not update that goal.' };
  }

  revalidateGoals();
  return { success: true, data: undefined };
}

/**
 * Marks a goal completed or abandoned.
 *
 * Abandoning is a first-class outcome rather than a deletion. A goal that
 * turned out to be unrealistic is useful information, and quietly removing it
 * makes the history look tidier than it was.
 */
export async function setGoalStatusAction(
  values: unknown
): Promise<ActionResult> {
  const parsed = goalStatusSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, error: 'That status is not valid.' };
  }

  const { goalId, status } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from('goals')
    .update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', goalId);

  if (error) {
    return { success: false, error: 'Could not update that goal.' };
  }

  revalidateGoals();
  return { success: true, data: undefined };
}

export async function deleteGoalAction(goalId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('goals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', goalId);

  if (error) {
    return { success: false, error: 'Could not remove that goal.' };
  }

  revalidateGoals();
  return { success: true, data: undefined };
}
