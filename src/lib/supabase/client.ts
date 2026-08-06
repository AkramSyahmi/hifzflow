import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';

import type { Database } from './database.types';

/**
 * Supabase client for Client Components.
 *
 * Only ever holds the anon key, so every request it makes is subject to Row
 * Level Security. Used for OAuth redirects and realtime subscriptions; all
 * mutations go through Server Actions instead.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
