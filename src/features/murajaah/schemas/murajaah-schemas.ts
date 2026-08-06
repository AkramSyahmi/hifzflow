import { z } from 'zod';

/**
 * Validation for murajaah planning and review logging.
 * One schema, used by both the form resolver and the Server Action.
 */

export const completeItemSchema = z.object({
  itemId: z.string().uuid(),
  confidence: z.coerce.number().int().min(1).max(5),
  notes: z.string().trim().max(2000).nullish(),
});

export const planSchema = z
  .object({
    editionId: z.coerce.number().int().positive(),
    mode: z.enum(['daily_quantity', 'cycle_length']),
    dailyPages: z.coerce
      .number()
      .int()
      .min(1, 'At least one page a day')
      .max(60, 'Sixty pages a day is not a plan, it is a wish'),
    cycleDays: z.coerce
      .number()
      .int()
      .min(1, 'A cycle is at least a day')
      .max(365, 'Cycles longer than a year are not useful'),
    sabqiWindowDays: z.coerce.number().int().min(0).max(365),
    sabqiDailyPages: z.coerce.number().int().min(0).max(60),
    includeWeak: z.boolean(),
    weakThreshold: z.coerce.number().int().min(1).max(5),
    restDays: z.array(z.coerce.number().int().min(0).max(6)).max(6),
  })
  .refine(
    (values) =>
      values.mode !== 'daily_quantity' ||
      values.sabqiDailyPages <= values.dailyPages,
    {
      message: 'Sabqi cannot exceed the whole daily budget',
      path: ['sabqiDailyPages'],
    }
  );

export type CompleteItemInput = z.infer<typeof completeItemSchema>;
export type PlanInput = z.infer<typeof planSchema>;
