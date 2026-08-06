import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

export interface PageStatus {
  page_number: number;
  juz: number;
  ayah_count: number;
  memorised_ayahs: number;
}

/**
 * Every page of an edition with the caller's memorised ayah count.
 *
 * Returned by a database function rather than assembled here, because the grid
 * needs all 604 pages including untouched ones, and a left join in SQL is
 * cheaper than reconciling two lists in application code.
 */
export const getPageStatus = cache(
  async (editionId: number): Promise<PageStatus[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('page_status', {
      p_edition_id: editionId,
    });

    if (error) {
      throw new Error(`Could not load page progress: ${error.message}`);
    }
    return data ?? [];
  }
);
