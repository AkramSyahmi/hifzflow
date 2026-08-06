import { z } from 'zod';

import { MADANI_PAGE_COUNT, TOTAL_AYAHS, TOTAL_SURAHS } from '@/lib/constants';

/**
 * Validation for memorisation entry.
 *
 * Defined once and used both as the React Hook Form resolver and as the parser
 * inside the Server Action. The client copy gives instant feedback; the server
 * copy is the one that actually enforces anything.
 */

const confidence = z.coerce.number().int().min(1).max(5).nullish();

const memorisedOn = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return false;
    // A day of slack absorbs a client clock running ahead of the server.
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return parsed <= tomorrow;
  }, 'That date is in the future')
  .nullish();

const notes = z
  .string()
  .trim()
  .max(2000, 'Keep notes under 2000 characters')
  .nullish();

const status = z.enum(['learning', 'memorised']);

export const recordPagesSchema = z
  .object({
    editionId: z.coerce.number().int().positive(),
    firstPage: z.coerce
      .number()
      .int()
      .min(1, 'Pages start at 1')
      .max(MADANI_PAGE_COUNT, `Pages end at ${MADANI_PAGE_COUNT}`),
    lastPage: z.coerce
      .number()
      .int()
      .min(1, 'Pages start at 1')
      .max(MADANI_PAGE_COUNT, `Pages end at ${MADANI_PAGE_COUNT}`),
    status: status.default('memorised'),
    confidence,
    memorisedOn,
    notes,
  })
  .refine((values) => values.firstPage <= values.lastPage, {
    message: 'The first page must come before the last',
    path: ['lastPage'],
  });

export const recordAyahsSchema = z
  .object({
    firstAyah: z.coerce.number().int().min(1).max(TOTAL_AYAHS),
    lastAyah: z.coerce.number().int().min(1).max(TOTAL_AYAHS),
    status: status.default('memorised'),
    confidence,
    memorisedOn,
    notes,
  })
  .refine((values) => values.firstAyah <= values.lastAyah, {
    message: 'The first ayah must come before the last',
    path: ['lastAyah'],
  });

export const recordSurahSchema = z.object({
  surahNumber: z.coerce.number().int().min(1).max(TOTAL_SURAHS),
  status: status.default('memorised'),
  confidence,
  memorisedOn,
  notes,
});

export const togglePageSchema = z.object({
  editionId: z.coerce.number().int().positive(),
  page: z.coerce.number().int().min(1).max(MADANI_PAGE_COUNT),
  /** True marks the page memorised; false clears it. */
  memorised: z.boolean(),
});

export const removePagesSchema = z
  .object({
    editionId: z.coerce.number().int().positive(),
    firstPage: z.coerce.number().int().min(1).max(MADANI_PAGE_COUNT),
    lastPage: z.coerce.number().int().min(1).max(MADANI_PAGE_COUNT),
  })
  .refine((values) => values.firstPage <= values.lastPage, {
    message: 'The first page must come before the last',
    path: ['lastPage'],
  });

export type RecordPagesInput = z.infer<typeof recordPagesSchema>;
export type RecordAyahsInput = z.infer<typeof recordAyahsSchema>;
export type RecordSurahInput = z.infer<typeof recordSurahSchema>;
export type TogglePageInput = z.infer<typeof togglePageSchema>;
export type RemovePagesInput = z.infer<typeof removePagesSchema>;
