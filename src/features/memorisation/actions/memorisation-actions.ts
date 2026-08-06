'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types';

import {
  recordAyahsSchema,
  recordPagesSchema,
  recordSurahSchema,
  removePagesSchema,
  togglePageSchema,
} from '../schemas/memorisation-schemas';

/**
 * Memorisation Server Actions.
 *
 * Each one is a thin wrapper over a database function. The gap-filling and
 * segment-splitting logic lives in PostgreSQL because it is multi-statement and
 * must be atomic — doing it here would leave a window in which a range has been
 * deleted but its remainder has not yet been written.
 *
 * No user id is ever passed. The functions are SECURITY INVOKER, so they run as
 * the caller and RLS scopes every row they touch.
 */

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

function revalidateProgress() {
  revalidatePath('/memorisation');
  revalidatePath('/dashboard');
}

/** Human-readable summary of what a write actually changed. */
export interface RecordSummary {
  segmentsCreated: number;
  ayahsAdded: number;
}

export async function recordPagesAction(
  values: unknown
): Promise<ActionResult<RecordSummary>> {
  const parsed = recordPagesSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('record_pages', {
    p_edition_id: input.editionId,
    p_first_page: input.firstPage,
    p_last_page: input.lastPage,
    p_status: input.status,
    p_confidence: input.confidence ?? null,
    p_memorised_on: input.memorisedOn ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) {
    return {
      success: false,
      error: 'Could not save that. Try again in a moment.',
    };
  }

  revalidateProgress();

  return {
    success: true,
    data: {
      segmentsCreated: data.length,
      ayahsAdded: data.reduce((sum, row) => {
        const match = /^\[(\d+),(\d+)\)$/.exec(row.ayah_range);
        if (!match) return sum;
        return sum + (Number(match[2]) - Number(match[1]));
      }, 0),
    },
  };
}

export async function recordAyahsAction(
  values: unknown
): Promise<ActionResult<RecordSummary>> {
  const parsed = recordAyahsSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('record_memorisation', {
    p_first_ayah: input.firstAyah,
    p_last_ayah: input.lastAyah,
    p_status: input.status,
    p_confidence: input.confidence ?? null,
    p_memorised_on: input.memorisedOn ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) {
    return {
      success: false,
      error: 'Could not save that. Try again in a moment.',
    };
  }

  revalidateProgress();

  return {
    success: true,
    data: {
      segmentsCreated: data.length,
      ayahsAdded: input.lastAyah - input.firstAyah + 1,
    },
  };
}

export async function recordSurahAction(
  values: unknown
): Promise<ActionResult<RecordSummary>> {
  const parsed = recordSurahSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('record_surah', {
    p_surah_number: input.surahNumber,
    p_status: input.status,
    p_confidence: input.confidence ?? null,
    p_memorised_on: input.memorisedOn ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) {
    return {
      success: false,
      error: 'Could not save that. Try again in a moment.',
    };
  }

  revalidateProgress();

  return {
    success: true,
    data: { segmentsCreated: data.length, ayahsAdded: 0 },
  };
}

export async function removePagesAction(
  values: unknown
): Promise<ActionResult<{ ayahsRemoved: number }>> {
  const parsed = removePagesSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('remove_pages', {
    p_edition_id: input.editionId,
    p_first_page: input.firstPage,
    p_last_page: input.lastPage,
  });

  if (error) {
    return {
      success: false,
      error: 'Could not remove that. Try again in a moment.',
    };
  }

  revalidateProgress();

  return { success: true, data: { ayahsRemoved: data ?? 0 } };
}

export async function removeSurahAction(
  surahNumber: number
): Promise<ActionResult<{ ayahsRemoved: number }>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('remove_surah', {
    p_surah_number: surahNumber,
  });

  if (error) {
    return {
      success: false,
      error: 'Could not remove that. Try again in a moment.',
    };
  }

  revalidateProgress();

  return { success: true, data: { ayahsRemoved: data ?? 0 } };
}

/**
 * Marks or clears a single page.
 *
 * The fast path behind the tracking grid, so it stays deliberately small: one
 * round trip, no metadata, no dialog. Anything richer goes through the record
 * form instead.
 */
export async function togglePageAction(
  values: unknown
): Promise<ActionResult<{ memorised: boolean }>> {
  const parsed = togglePageSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, error: 'That page number is not valid.' };
  }

  const { editionId, page, memorised } = parsed.data;
  const supabase = await createClient();

  const { error } = memorised
    ? await supabase.rpc('record_pages', {
        p_edition_id: editionId,
        p_first_page: page,
        p_last_page: page,
        p_status: 'memorised',
        p_confidence: null,
        p_memorised_on: null,
        p_notes: null,
      })
    : await supabase.rpc('remove_pages', {
        p_edition_id: editionId,
        p_first_page: page,
        p_last_page: page,
      });

  if (error) {
    return {
      success: false,
      error: `Could not update page ${page}.`,
    };
  }

  revalidateProgress();

  return { success: true, data: { memorised } };
}
