import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { DEFAULT_SIGNED_IN_PATH } from '@/lib/supabase/middleware';
import { createClient } from '@/lib/supabase/server';

/**
 * Email link handler.
 *
 * Covers signup confirmation, password recovery, email change and magic links.
 * Supabase sends a `token_hash` plus a `type`; verifying the pair establishes
 * a session. The token is single-use, so a link that has already been opened
 * fails here and the user is sent back to request a fresh one.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/sign-in?error=link_invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    const destination =
      type === 'recovery'
        ? `${origin}/forgot-password?error=link_expired`
        : `${origin}/sign-in?error=link_expired`;
    return NextResponse.redirect(destination);
  }

  if (type === 'recovery') {
    // `flow=recovery` is what tells middleware to let a signed-in user reach
    // the reset page instead of bouncing them to the dashboard.
    return NextResponse.redirect(`${origin}/reset-password?flow=recovery`);
  }

  return NextResponse.redirect(`${origin}${DEFAULT_SIGNED_IN_PATH}?welcome=1`);
}
