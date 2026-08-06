import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

import type { GoalProgress } from '../lib/pace';

/** Reads are scoped by RLS; no user id is passed. */

export const getGoals = cache(async (): Promise<GoalProgress[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_goal_progress')
    .select('*')
    .order('status')
    .order('target_date');

  if (error) throw new Error(`Could not load goals: ${error.message}`);
  return data;
});

/**
 * The goal to feature on the dashboard.
 *
 * The nearest active deadline, because that is the one whose pace matters
 * today. Completed and abandoned goals never surface here.
 */
export const getPrimaryGoal = cache(async (): Promise<GoalProgress | null> => {
  const goals = await getGoals();
  const active = goals.filter(
    (goal) => goal.status === 'active' && goal.state !== 'complete'
  );
  return active[0] ?? null;
});
