import 'server-only';

import { cache } from 'react';

import type { Tables, Views } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';

export type MemorisationSegment = Tables<'memorisation_segments'>;
export type SurahProgress = Views<'v_surah_progress'>;
export type JuzProgress = Views<'v_juz_progress'>;
export type PageProgress = Views<'v_page_progress'>;
export type MemorisationSummary = Views<'v_memorisation_summary'>;

/**
 * Every query here relies on RLS to scope rows to the caller — no user id is
 * ever passed in. Note the explicit `deleted_at` filter on the base table: the
 * policy checks ownership only, deliberately, because a policy that also
 * filtered on deleted_at would make soft delete impossible.
 */

export const getSegments = cache(async (): Promise<MemorisationSegment[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('memorisation_segments')
    .select('*')
    .is('deleted_at', null)
    .order('ayah_range');

  if (error) {
    throw new Error(`Could not load memorisation records: ${error.message}`);
  }
  return data;
});

export const getSummary = cache(
  async (): Promise<MemorisationSummary | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('v_memorisation_summary')
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Could not load summary: ${error.message}`);
    return data;
  }
);

export const getJuzProgress = cache(async (): Promise<JuzProgress[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_juz_progress')
    .select('*')
    .order('juz');

  if (error) throw new Error(`Could not load juz progress: ${error.message}`);
  return data;
});

export const getSurahProgress = cache(async (): Promise<SurahProgress[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_surah_progress')
    .select('*')
    .order('surah_number');

  if (error) throw new Error(`Could not load surah progress: ${error.message}`);
  return data;
});

export async function getPageProgress(
  editionId: number
): Promise<PageProgress[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_page_progress')
    .select('*')
    .eq('edition_id', editionId)
    .order('page_number');

  if (error) throw new Error(`Could not load page progress: ${error.message}`);
  return data;
}
