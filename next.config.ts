import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

// Points the plugin at the request config. No locale routing: see
// src/i18n/request.ts for why.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Fail the production build on type or lint errors. Never disable these:
  // a green build is the contract every milestone is handed over against.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },

  experimental: {
    // Server Actions accept file uploads later (profile avatars, mushaf imports).
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  /*
   * Static security headers. The Content-Security-Policy is deliberately not
   * here: it carries a per-request nonce, so it is built in middleware where
   * that value exists. See src/lib/security/csp.ts.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            // Two years, with preload, is the value the HSTS preload list
            // requires. Only meaningful over HTTPS, so it is inert locally.
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
