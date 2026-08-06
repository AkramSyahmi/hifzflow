import 'server-only';

import { cache } from 'react';

import type { Tables } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';

export type Surah = Tables<'surahs'>;
export type Ayah = Tables<'ayahs'>;
export type MushafEdition = Tables<'mushaf_editions'>;

/**
 * Reference data is immutable once seeded, so these queries are cached for the
 * whole request and marked as static-friendly. They are the same for every
 * user, which is why they carry no ownership filtering.
 */

export const getSurahs = cache(async (): Promise<Surah[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('surahs')
    .select('*')
    .order('number');

  if (error) throw new Error(`Could not load surahs: ${error.message}`);
  return data;
});

export const getSurah = cache(async (number: number): Promise<Surah | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('surahs')
    .select('*')
    .eq('number', number)
    .maybeSingle();

  if (error)
    throw new Error(`Could not load surah ${number}: ${error.message}`);
  return data;
});

export const getDefaultEdition = cache(
  async (): Promise<MushafEdition | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('mushaf_editions')
      .select('*')
      .eq('is_default', true)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load the default mushaf: ${error.message}`);
    }
    return data;
  }
);

/** Every ayah on a printed page, for a given edition. */
export async function getAyahsOnPage(
  pageNumber: number,
  editionId: number
): Promise<Ayah[]> {
  const supabase = await createClient();

  const { data: page, error: pageError } = await supabase
    .from('mushaf_pages')
    .select('ayah_range')
    .eq('edition_id', editionId)
    .eq('page_number', pageNumber)
    .maybeSingle();

  if (pageError) {
    throw new Error(`Could not load page ${pageNumber}: ${pageError.message}`);
  }
  if (!page) return [];

  const { parseRange } = await import('../lib/ranges');
  const range = parseRange(page.ayah_range);

  const { data, error } = await supabase
    .from('ayahs')
    .select('*')
    .gte('id', range.start)
    .lte('id', range.end)
    .order('id');

  if (error) throw new Error(`Could not load ayahs: ${error.message}`);
  return data;
}
