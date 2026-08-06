'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { LOCALE_COOKIE } from '@/i18n/request';
import { isProduction } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types';

import {
  deleteAccountSchema,
  localeSchema,
  profileSchema,
  remindersSchema,
} from '../schemas/settings-schemas';

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

export async function updateProfileAction(
  values: unknown
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: parsed.data.displayName,
      timezone: parsed.data.timezone,
    })
    .not('id', 'is', null);

  if (error) {
    return { success: false, error: 'Could not save your profile.' };
  }

  // Changing timezone shifts every local-day boundary, so the queue and streak
  // figures on other pages are stale until they are rebuilt.
  revalidatePath('/', 'layout');
  return { success: true, data: undefined };
}

/**
 * Changes the interface language.
 *
 * Written in two places on purpose. The cookie is what the request config reads
 * before any database round trip, so it takes effect on the very next render.
 * The profile holds the durable preference, so a different device picks up the
 * right language on first load rather than defaulting to English.
 */
export async function updateLocaleAction(
  values: unknown
): Promise<ActionResult> {
  const parsed = localeSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, error: 'That language is not supported.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ locale: parsed.data.locale })
    .not('id', 'is', null);

  if (error) {
    return { success: false, error: 'Could not change the language.' };
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, parsed.data.locale, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/', 'layout');
  return { success: true, data: undefined };
}

export async function updateRemindersAction(
  values: unknown
): Promise<ActionResult> {
  const parsed = remindersSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      reminder_enabled: parsed.data.enabled,
      reminder_time: `${parsed.data.time}:00`,
      reminder_days: parsed.data.days,
    })
    .not('id', 'is', null);

  if (error) {
    return { success: false, error: 'Could not save your reminders.' };
  }

  revalidatePath('/settings');
  return { success: true, data: undefined };
}

/**
 * Returns the caller's data as a JSON string for download.
 *
 * Assembled by the database in one call rather than by several queries here, so
 * the export is a consistent snapshot rather than a set of reads that could
 * interleave with a write.
 */
export async function exportDataAction(): Promise<
  ActionResult<{ filename: string; json: string }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('export_my_data');

  if (error || !data) {
    return { success: false, error: 'Could not prepare your export.' };
  }

  const stamp = new Date().toISOString().slice(0, 10);

  return {
    success: true,
    data: {
      filename: `hifzflow-export-${stamp}.json`,
      json: JSON.stringify(data, null, 2),
    },
  };
}

/**
 * Deletes the account and everything attached to it.
 *
 * The database function takes no arguments and removes exactly `auth.uid()`,
 * cascading through every table. There is no soft-delete fallback: someone
 * asking to be deleted is asking for deletion, and quietly retaining their
 * records instead would misrepresent what the button does.
 */
export async function deleteAccountAction(
  values: unknown
): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Type the confirmation phrase exactly.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_my_account');

  if (error) {
    return {
      success: false,
      error: 'Could not delete the account. Nothing has been removed.',
    };
  }

  // The session now points at a user that no longer exists, so it must be
  // discarded rather than left to fail on the next request.
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/?deleted=1');
}
