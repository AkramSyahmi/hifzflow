import 'server-only';

import { cache } from 'react';

import type { Views } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';

import type { ActivityDay } from '../lib/activity';

export type ActivitySummary = Views<'v_activity_summary'>;

/**
 * A window of daily activity with empty days included.
 *
 * The gap filling happens in SQL so the client renders what it is handed
 * rather than reconciling a sparse list against a calendar it has to build.
 */
export async function getActivityCalendar(
  from: string,
  to: string
): Promise<ActivityDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('activity_calendar', {
    p_from: from,
    p_to: to,
  });

  if (error) throw new Error(`Could not load activity: ${error.message}`);
  return data ?? [];
}

export const getActivitySummary = cache(
  async (): Promise<ActivitySummary | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('v_activity_summary')
      .select('*')
      .maybeSingle();

    if (error) return null;
    return data;
  }
);
