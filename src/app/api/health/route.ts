import { NextResponse } from 'next/server';

import { APP_NAME } from '@/lib/constants';
import { env } from '@/lib/env';

/**
 * Liveness endpoint.
 *
 * Used by uptime monitoring after deployment, and by a scheduled ping that
 * keeps the Supabase project from pausing on the free tier between recruiter
 * visits. Deliberately dependency-free so it stays green even when a
 * downstream service is not.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: APP_NAME,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
