import { describe, expect, it } from 'vitest';

import { buildCsp } from './csp';

const NONCE = 'abc123';

describe('buildCsp', () => {
  it('includes the nonce in script-src', () => {
    expect(buildCsp(NONCE, true)).toContain(`'nonce-${NONCE}'`);
  });

  it('uses strict-dynamic so Next.js can load its own chunks', () => {
    expect(buildCsp(NONCE, true)).toContain("'strict-dynamic'");
  });

  it('never allows unsafe-eval in production', () => {
    expect(buildCsp(NONCE, true)).not.toContain("'unsafe-eval'");
  });

  it('allows unsafe-eval in development, for Fast Refresh only', () => {
    expect(buildCsp(NONCE, false)).toContain("'unsafe-eval'");
  });

  it('blocks framing entirely', () => {
    const policy = buildCsp(NONCE, true);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });

  it('locks base-uri and form-action to the origin', () => {
    const policy = buildCsp(NONCE, true);
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
  });

  it('permits Supabase over https and websockets', () => {
    const policy = buildCsp(NONCE, true);
    expect(policy).toContain('https://*.supabase.co');
    expect(policy).toContain('wss://*.supabase.co');
  });

  it('does not permit localhost in production', () => {
    expect(buildCsp(NONCE, true)).not.toContain('localhost');
  });

  it('upgrades insecure requests only in production', () => {
    expect(buildCsp(NONCE, true)).toContain('upgrade-insecure-requests');
    expect(buildCsp(NONCE, false)).not.toContain('upgrade-insecure-requests');
  });

  it('allows blob: for workers and the export download', () => {
    const policy = buildCsp(NONCE, true);
    expect(policy).toContain("worker-src 'self' blob:");
    expect(policy).toContain('blob:');
  });

  it('produces one semicolon-separated directive list', () => {
    const policy = buildCsp(NONCE, true);
    expect(policy.split('; ').length).toBeGreaterThan(10);
    expect(policy).not.toContain(';;');
  });
});
