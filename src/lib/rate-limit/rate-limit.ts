import 'server-only';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

import { createClient } from '@/lib/supabase/server';

/**
 * Rate limiting for pre-auth Server Actions.
 *
 * The bucket key is hashed here, not in the database, so the counter table
 * never holds an email address or an IP. That matters because it is one of the
 * very few tables the anonymous role can reach at all.
 *
 * A salt is mixed in so the hashes are not a rainbow-table lookup away from the
 * addresses they represent. The site URL is used because it is already a
 * required environment variable — a dedicated secret would be marginally better
 * but is one more thing to configure and lose.
 */

export type RateLimitScope =
  'sign_in' | 'sign_up' | 'password_reset' | 'password_update';

interface Policy {
  attempts: number;
  windowSeconds: number;
}

/**
 * Limits are per identifier, and deliberately not uniform.
 *
 * Sign-in is the loosest, because people genuinely mistype passwords and
 * locking them out is a support burden that also hands an attacker a denial of
 * service. Password reset is the tightest, because each attempt sends an email
 * to a third party, so abuse there is abuse of someone else.
 */
const POLICIES: Record<RateLimitScope, Policy> = {
  sign_in: { attempts: 10, windowSeconds: 300 },
  sign_up: { attempts: 5, windowSeconds: 3600 },
  password_reset: { attempts: 3, windowSeconds: 3600 },
  password_update: { attempts: 5, windowSeconds: 900 },
};

function salt(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'hifzflow';
}

function bucketFor(scope: RateLimitScope, identifier: string): string {
  const digest = createHash('sha256')
    .update(`${salt()}:${scope}:${identifier.toLowerCase().trim()}`)
    .digest('hex');
  return `${scope}:${digest}`;
}

/**
 * The caller's IP, as reported by the proxy in front of the app.
 *
 * `x-forwarded-for` can be a list; the first entry is the client. Behind
 * Vercel it is set by the platform and cannot be spoofed by the client, but on
 * an arbitrary host it can be, which is why the address is only ever one of two
 * limits and never the only one.
 */
async function clientAddress(): Promise<string> {
  const store = await headers();
  const forwarded = store.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return store.get('x-real-ip') ?? 'unknown';
}

export interface RateLimitResult {
  allowed: boolean;
  /** Message safe to show the user. Never says which limit was hit. */
  message: string;
}

const REFUSED = 'Too many attempts. Wait a few minutes before trying again.';

/**
 * Consumes one attempt against both the identifier and the caller's address.
 *
 * Two limits, because either alone is trivially defeated. Limiting by address
 * only lets an attacker spray one attempt each at thousands of addresses;
 * limiting by address only lets a botnet grind one account. Both are consumed on
 * every call so a refusal on either stops the request.
 *
 * Fails **open**. If the limiter itself errors the request proceeds, because a
 * database hiccup that locked everyone out of sign-in would be a worse outcome
 * than a brief window with no limiting. Supabase Auth applies its own limits
 * underneath this, so the floor is never zero.
 */
export async function checkRateLimit(
  scope: RateLimitScope,
  identifier: string
): Promise<RateLimitResult> {
  const policy = POLICIES[scope];

  try {
    const supabase = await createClient();
    const address = await clientAddress();

    const buckets = [
      bucketFor(scope, identifier),
      bucketFor(scope, `ip:${address}`),
    ];

    const outcomes = await Promise.all(
      buckets.map((bucket) =>
        supabase.rpc('consume_rate_limit', {
          p_bucket: bucket,
          p_max_attempts: policy.attempts,
          p_window_seconds: policy.windowSeconds,
        })
      )
    );

    const refused = outcomes.some(
      (outcome) => outcome.error === null && outcome.data === false
    );

    return refused
      ? { allowed: false, message: REFUSED }
      : { allowed: true, message: '' };
  } catch {
    return { allowed: true, message: '' };
  }
}
