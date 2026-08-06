import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';

/**
 * Scheduled keepalive.
 *
 * Supabase pauses a free-tier project after seven days without database
 * activity. For a portfolio project that recruiters visit sporadically, that
 * means the demo is asleep exactly when someone looks at it — and the first
 * visitor gets an error rather than the app.
 *
 * A weekly query is enough to prevent it. This also prunes stale rate limit
 * buckets, which otherwise accumulate one row per address ever tried.
 *
 * Deliberately separate from `/api/health`: that endpoint is dependency-free so
 * it stays green when a downstream service is not, and adding a database call
 * would defeat the point of having it.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  /*
   * Vercel signs scheduled invocations with the deployment's CRON_SECRET. The
   * check is mandatory rather than best-effort: without it this is a public
   * endpoint that runs a privileged prune, and the service role key it uses
   * bypasses RLS entirely.
   */
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 }
    );
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' },
      { status: 500 }
    );
  }

  // Created inline rather than through the shared helper: this is the only
  // place in the application that uses the service role, and keeping it local
  // makes that obvious to anyone reading for privilege escalation.
  const supabase = createServiceClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey,
    { auth: { persistSession: false } }
  );

  // A trivial read against seeded reference data. Enough to count as activity,
  // and it cannot fail because of a user's data being in an odd state.
  const { error: pingError } = await supabase
    .from('mushaf_editions')
    .select('id')
    .limit(1);

  if (pingError) {
    return NextResponse.json(
      { status: 'error', stage: 'ping', message: pingError.message },
      { status: 502 }
    );
  }

  const { data: pruned, error: pruneError } = await supabase.rpc(
    'prune_rate_limits',
    { p_older_than_hours: 24 }
  );

  return NextResponse.json(
    {
      status: 'ok',
      pinged: true,
      rateLimitsPruned: pruneError ? null : (pruned ?? 0),
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
