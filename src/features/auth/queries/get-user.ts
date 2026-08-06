import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

/**
 * The authenticated user, or null.
 *
 * Wrapped in React's `cache` so that several Server Components in one render
 * pass share a single call rather than each hitting the auth server.
 *
 * Always `getUser()`, never `getSession()`: the latter reads the cookie
 * without verifying it against the auth server, so its contents can be forged.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The authenticated user, or a redirect to sign-in.
 *
 * Middleware already gates protected routes, but this is the second lock: a
 * route rendered outside the matcher, or a future refactor of it, would
 * otherwise leak data. Authorisation is checked where the data is read.
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/sign-in');
  return user;
}
