/**
 * Application-wide constants.
 *
 * Quran totals are fixed facts, not configuration, so they live here rather
 * than in the database. Page counts are edition-specific and therefore
 * qualified: the Madani 604-page mushaf is the seeded default, and other
 * editions are added as rows in `mushaf_editions` from the database milestone.
 */

export const APP_NAME = 'HifzFlow';
export const APP_TAGLINE = 'Smart Quran memorisation and murajaah planner';
export const APP_DESCRIPTION =
  'Plan your hifz, keep your murajaah on schedule, and see exactly where your memorisation stands.';

/** Total ayahs in the Quran. The canonical unit the whole domain model uses. */
export const TOTAL_AYAHS = 6236;

/** Total surahs. */
export const TOTAL_SURAHS = 114;

/** Total juz'. */
export const TOTAL_JUZ = 30;

/** Total hizb (two per juz'). */
export const TOTAL_HIZB = 60;

/** Total rub' al-hizb (four per hizb). */
export const TOTAL_RUB = 240;

/** Page count of the default seeded mushaf edition. */
export const MADANI_PAGE_COUNT = 604;

/** Slug of the mushaf edition seeded by default. */
export const DEFAULT_MUSHAF_SLUG = 'madani-604';

/** Fallback timezone when a profile has not set one yet. */
export const DEFAULT_TIMEZONE = 'Asia/Kuala_Lumpur';

/** Locales the app is built to support. Only `en` is translated today. */
export const SUPPORTED_LOCALES = ['en', 'ms'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
