import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { DEFAULT_SIGNED_IN_PATH } from '@/lib/supabase/middleware';

/**
 * OAuth callback.
 *
 * The provider redirects here with a single-use `code`, which is exchanged for
 * a session. Only same-origin paths are accepted for `next`, so a crafted link
 * cannot bounce a freshly authenticated user off to an attacker's page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next');
  const next =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : DEFAULT_SIGNED_IN_PATH;

  // The provider reports user-facing failures here, for example a cancelled
  // consent screen.
  const providerError = searchParams.get('error');
  if (providerError) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth`);
  }

  /*
   * `x-forwarded-host` is set by Vercel's proxy. Behind it, `origin` is the
   * internal address, so redirecting to it would send the user somewhere
   * unreachable. Trusted only when not running locally.
   */
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';

  if (!isLocal && forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
