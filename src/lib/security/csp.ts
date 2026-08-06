/**
 * Content Security Policy.
 *
 * Built per request, because a nonce is only useful if it is unpredictable.
 *
 * Two deliberate compromises, both worth stating rather than hiding:
 *
 *   `style-src 'unsafe-inline'` — React writes inline style attributes, and
 *   Recharts sets dozens of them per chart. There is no nonce mechanism for
 *   style attributes, so the alternative is no CSP at all. Inline styles are a
 *   far lower risk than inline scripts: what they enable is layout tampering and
 *   exfiltration by background image, not code execution.
 *
 *   `'strict-dynamic'` — Next.js loads its chunks from scripts rather than from
 *   markup, so a host allow-list does not cover them. `strict-dynamic` lets a
 *   nonced script load further scripts, which is the intended pattern and is
 *   stronger than allow-listing a CDN by hostname.
 */
export function buildCsp(nonce: string, isProduction: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],

    // `unsafe-eval` is required by React Fast Refresh, so it is development
    // only. Shipping it would defeat most of the point of the policy.
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isProduction ? [] : ["'unsafe-eval'"]),
    ],

    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],

    // `blob:` covers the object URLs the data export creates and `data:` covers
    // inline SVG. Avatars come from Google's user-content hosts.
    'img-src': ["'self'", 'data:', 'blob:', 'https://*.googleusercontent.com'],

    // Supabase over both HTTPS and websockets, the latter for realtime.
    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      ...(isProduction ? [] : ['ws://localhost:*', 'http://localhost:*']),
    ],

    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],

    // Nothing in this application embeds anything, or is meant to be embedded.
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],

    // Stops an injected <base> redirecting every relative URL, and an injected
    // form posting credentials off-origin.
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };

  const policy = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');

  // Only upgrade in production: locally the app is served over plain HTTP.
  return isProduction ? `${policy}; upgrade-insecure-requests` : policy;
}
