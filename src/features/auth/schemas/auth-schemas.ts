import { z } from 'zod';

import { SUPPORTED_LOCALES } from '@/lib/constants';

/**
 * Auth validation schemas.
 *
 * Each schema is defined once and used in two places: as the React Hook Form
 * resolver, and as the parser inside the Server Action. The client copy is a
 * convenience that gives instant feedback; the server copy is the one that
 * actually enforces anything, because a client can always be bypassed.
 */

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .email('That does not look like a valid email address')
  .max(254, 'Email address is too long')
  .toLowerCase();

/**
 * Length beats composition rules. NIST 800-63B advises against mandatory
 * character-class requirements — they push people toward predictable
 * substitutions — and recommends a generous minimum instead. 72 bytes is
 * bcrypt's hard limit, above which extra characters are silently ignored.
 */
const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Use 72 characters or fewer');

/**
 * Validated against the runtime's own IANA database rather than a hand-kept
 * list, so it stays correct as timezones are added or renamed.
 */
const timezone = z
  .string()
  .min(3)
  .max(64)
  .refine(
    (value) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Unrecognised timezone' }
  );

const locale = z.enum(SUPPORTED_LOCALES);

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    .max(60, 'Use 60 characters or fewer'),
  email,
  password,
  // Captured from the browser at submit time, not chosen by the user. The
  // whole streak and daily-target model depends on knowing their local day.
  timezone: timezone.catch('Asia/Kuala_Lumpur'),
  locale: locale.catch('en'),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
