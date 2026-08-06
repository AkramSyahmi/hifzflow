import 'server-only';

import { cache } from 'react';

import type { Views } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';

export type PageStrength = Views<'v_page_strength'>;
export type ReviewTotals = Views<'v_review_totals'>;

export interface ReviewTrendPoint {
  week_start: string;
  total_reviews: number;
  sabqi_reviews: number;
  manzil_reviews: number;
  weak_reviews: number;
  average_confidence: number | null;
}

export interface GrowthPoint {
  day: string;
  ayahs_added: number;
  cumulative_ayahs: number;
}

export const getReviewTotals = cache(async (): Promise<ReviewTotals | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_review_totals')
    .select('*')
    .maybeSingle();

  if (error) return null;
  return data;
});

/**
 * Pages ranked by strength.
 *
 * Only measured pages are ranked. A page reviewed once and rated five is not
 * stronger than one reviewed twenty times averaging four and a half — it is
 * less measured, and presenting it as a top performer would be misleading.
 */
export const getStrongestPages = cache(
  async (limit = 10): Promise<PageStrength[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('v_page_strength')
      .select('*')
      .eq('is_measured', true)
      .not('strength', 'is', null)
      .order('strength', { ascending: false })
      .order('review_count', { ascending: false })
      .limit(limit);

    if (error)
      throw new Error(`Could not load page strength: ${error.message}`);
    return data;
  }
);

export const getWeakestPages = cache(
  async (limit = 10): Promise<PageStrength[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('v_page_strength')
      .select('*')
      .eq('is_measured', true)
      .not('strength', 'is', null)
      .order('strength', { ascending: true })
      .order('days_since_review', { ascending: false })
      .limit(limit);

    if (error)
      throw new Error(`Could not load page strength: ${error.message}`);
    return data;
  }
);

export const getMostReviewedPages = cache(
  async (limit = 10): Promise<PageStrength[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('v_page_strength')
      .select('*')
      .gt('review_count', 0)
      .order('review_count', { ascending: false })
      .order('page_number', { ascending: true })
      .limit(limit);

    if (error)
      throw new Error(`Could not load review counts: ${error.message}`);
    return data;
  }
);

export async function getReviewTrend(
  from: string,
  to: string
): Promise<ReviewTrendPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('review_trend', {
    p_from: from,
    p_to: to,
  });

  if (error) throw new Error(`Could not load review trend: ${error.message}`);
  return data ?? [];
}

export async function getMemorisationGrowth(
  from: string,
  to: string
): Promise<GrowthPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('memorisation_growth', {
    p_from: from,
    p_to: to,
  });

  if (error) throw new Error(`Could not load growth: ${error.message}`);
  return data ?? [];
}
