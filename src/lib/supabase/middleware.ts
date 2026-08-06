import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { buildCsp } from '@/lib/security/csp';
import { env, isProduction } from '@/lib/env';

import type { Database } from './database.types';

/** Routes that require a session. Everything under these prefixes is gated. */
const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/settings'];

/** Auth routes a signed-in user should not see. */
const AUTH_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
];

/** Where a signed-in user lands. */
export const DEFAULT_SIGNED_IN_PATH = '/dashboard';

function isMatch(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Refreshes the Supabase session and enforces route access.
 *
 * Two rules make this correct, and breaking either causes users to be
 * randomly signed out:
 *
 *  1. Cookies must be written to *both* the request and the response.
 *     The request copy is what `getUser()` reads later in the same pass; the
 *     response copy is what the browser receives.
 *  2. `getUser()` must be called, not `getSession()`. `getSession()` trusts
 *     the cookie without contacting the auth server, so it can be forged.
 */
export async function updateSession(request: NextRequest) {
  /*
   * The nonce has to be generated here rather than in the layout, because the
   * CSP header and the scripts it authorises must carry the same value and only
   * middleware sees both. Forwarding it on the request lets Next.js attach it to
   * its own script tags automatically, and lets the layout read it for the one
   * third-party inline script the app renders.
   */
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildCsp(nonce, isProduction);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.headers.set('content-security-policy', csp);
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isMatch(pathname, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = '';
    // Preserve where they were headed so sign-in can return them there.
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (user && isMatch(pathname, AUTH_ROUTES)) {
    // Password recovery is the exception: the user holds a valid session at
    // that point precisely so they can set a new password.
    const isRecovery =
      pathname === '/reset-password' &&
      request.nextUrl.searchParams.get('flow') === 'recovery';

    if (!isRecovery) {
      const url = request.nextUrl.clone();
      url.pathname = DEFAULT_SIGNED_IN_PATH;
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return response;
}
