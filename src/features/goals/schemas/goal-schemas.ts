import { z } from 'zod';

import {
  MADANI_PAGE_COUNT,
  TOTAL_AYAHS,
  TOTAL_JUZ,
  TOTAL_SURAHS,
} from '@/lib/constants';

/** Validation for goal creation and editing. */

const scopeType = z.enum(['quran', 'juz', 'surah', 'pages', 'ayahs']);

const targetDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return false;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return parsed >= today;
  }, 'Pick a date in the future');

const LIMITS: Record<z.infer<typeof scopeType>, number> = {
  quran: 1,
  juz: TOTAL_JUZ,
  surah: TOTAL_SURAHS,
  pages: MADANI_PAGE_COUNT,
  ayahs: TOTAL_AYAHS,
};

export const createGoalSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Give the goal a name')
      .max(80, 'Use 80 characters or fewer'),
    scopeType,
    scopeFrom: z.coerce.number().int().min(1).nullish(),
    scopeTo: z.coerce.number().int().min(1).nullish(),
    targetDate,
    editionId: z.coerce.number().int().positive().default(1),
  })
  .superRefine((values, ctx) => {
    if (values.scopeType === 'quran') return;

    if (values.scopeFrom == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose where the scope starts',
        path: ['scopeFrom'],
      });
      return;
    }

    const limit = LIMITS[values.scopeType];

    if (values.scopeFrom > limit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `The highest is ${limit}`,
        path: ['scopeFrom'],
      });
    }

    if (values.scopeTo != null) {
      if (values.scopeTo > limit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `The highest is ${limit}`,
          path: ['scopeTo'],
        });
      }
      if (values.scopeTo < values.scopeFrom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'The end must come after the start',
          path: ['scopeTo'],
        });
      }
    }
  });

export const updateGoalSchema = z.object({
  goalId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  targetDate,
});

export const goalStatusSchema = z.object({
  goalId: z.string().uuid(),
  status: z.enum(['active', 'completed', 'abandoned']),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type GoalStatusInput = z.infer<typeof goalStatusSchema>;
