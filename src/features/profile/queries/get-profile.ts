import 'server-only';

import { cache } from 'react';

import type { Tables } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/server';

export type Profile = Tables<'profiles'>;

/**
 * The signed-in user's profile.
 *
 * No user id is passed in by the caller: RLS scopes the query to the caller's
 * own row, so `.single()` either returns their profile or nothing. Accepting
 * an id parameter here would invite a caller to pass someone else's.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .is('deleted_at', null)
    .single();

  if (error) return null;
  return data;
});
