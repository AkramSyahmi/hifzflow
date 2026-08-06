import { z } from 'zod';

/**
 * Environment validation.
 *
 * Parsed once at module load so a missing or malformed variable fails the
 * build loudly instead of surfacing as a runtime `undefined` in production.
 */
const serverSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url('NEXT_PUBLIC_SITE_URL must be a fully qualified URL')
    .default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a fully qualified URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short to be valid'),
});

/**
 * Client variables must be referenced by their full literal name so that
 * Next.js can statically inline them at build time. Destructuring
 * `process.env` here would break that substitution.
 */
const clientEnv = clientSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!clientEnv.success) {
  throw new Error(
    `Invalid public environment variables:\n${clientEnv.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')}\n\nCopy .env.example to .env.local and fill in the values.`
  );
}

const serverEnv = serverSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
});

if (!serverEnv.success) {
  throw new Error(
    `Invalid server environment variables:\n${serverEnv.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')}`
  );
}

export const env = {
  ...serverEnv.data,
  ...clientEnv.data,
} as const;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
