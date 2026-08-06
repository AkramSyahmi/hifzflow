import 'server-only';

import { cache } from 'react';

import type { Tables, Views } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';

export type ReviewPlan = Tables<'review_plans'>;
export type QueueItem = Views<'v_review_queue'>;
export type PageReviewState = Views<'v_page_review_state'>;
export type ReviewStreak = Views<'v_review_streak'>;
export type ReviewSession = Tables<'review_sessions'>;

/** Every read here is scoped by RLS to the signed-in user; no id is passed. */

export const getPlan = cache(async (): Promise<ReviewPlan | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('review_plans')
    .select('*')
    .maybeSingle();

  if (error) throw new Error(`Could not load your plan: ${error.message}`);
  return data;
});

/**
 * Today's queue, generating it if this is the first request of the day.
 *
 * Generation is idempotent, so calling this on every page load is safe — the
 * function returns the existing queue rather than rebuilding it, which is what
 * keeps the day's plan stable while it is being worked through.
 */
export async function getTodayQueue(date: string): Promise<QueueItem[]> {
  const supabase = await createClient();

  const { error: ensureError } = await supabase.rpc('ensure_review_queue', {
    p_date: date,
  });
  if (ensureError) {
    throw new Error(`Could not prepare today's review: ${ensureError.message}`);
  }

  const { data, error } = await supabase
    .from('v_review_queue')
    .select('*')
    .eq('queue_date', date)
    .order('position');

  if (error) throw new Error(`Could not load today's review: ${error.message}`);
  return data;
}

/**
 * Items scheduled on earlier days and never completed.
 *
 * Capped, because someone returning after a long absence does not need a list
 * of four hundred missed pages — they need to know it is a lot, and to start.
 */
export async function getOverdue(
  beforeDate: string,
  limit = 50
): Promise<QueueItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_review_queue')
    .select('*')
    .lt('queue_date', beforeDate)
    .is('completed_at', null)
    .order('queue_date', { ascending: true })
    .order('position', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Could not load overdue items: ${error.message}`);
  return data;
}

export const getWeakPages = cache(
  async (limit = 20): Promise<PageReviewState[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('v_page_review_state')
      .select('*')
      .eq('is_weak', true)
      .order('last_reviewed_on', { ascending: true, nullsFirst: true })
      .limit(limit);

    if (error) throw new Error(`Could not load weak pages: ${error.message}`);
    return data;
  }
);

export const getStreak = cache(async (): Promise<ReviewStreak | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_review_streak')
    .select('*')
    .maybeSingle();

  if (error) return null;
  return data;
});

export async function getRecentSessions(limit = 20): Promise<ReviewSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('review_sessions')
    .select('*')
    .order('reviewed_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load history: ${error.message}`);
  return data;
}
