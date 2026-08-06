/**
 * Shared domain types.
 *
 * Feature-local types live beside their feature in `src/features/<name>/types`.
 * Only types used across more than one feature belong here.
 */

/** Lifecycle of a passage within a user's memorisation journey. */
export type MemorisationStatus =
  'new' | 'learning' | 'memorised' | 'weak' | 'overdue';

/**
 * Self-reported recall quality after a murajaah session.
 * Drives the spaced-repetition overlay that sits on top of the review cycle.
 */
export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

/** Units a user can view and enter memorisation in. */
export type QuranUnit = 'ayah' | 'page' | 'surah' | 'juz' | 'hizb' | 'rub';

/** Discriminated result type for Server Actions. */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
