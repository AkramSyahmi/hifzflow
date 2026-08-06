import { z } from 'zod';

import { SUPPORTED_LOCALES } from '@/lib/constants';

/** Validation for settings forms. */

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

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    .max(60, 'Use 60 characters or fewer'),
  timezone,
});

export const localeSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
});

export const remindersSchema = z.object({
  enabled: z.boolean(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time, such as 05:30'),
  days: z.array(z.coerce.number().int().min(0).max(6)).max(7),
});

export const deleteAccountSchema = z.object({
  // The exact phrase is required so deletion cannot happen through a mis-click.
  // Compared case-insensitively, but must otherwise match.
  confirmation: z
    .string()
    .trim()
    .refine((value) => value.toLowerCase() === 'delete my account', {
      message: 'Type the phrase exactly to confirm',
    }),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type LocaleInput = z.infer<typeof localeSchema>;
export type RemindersInput = z.infer<typeof remindersSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
