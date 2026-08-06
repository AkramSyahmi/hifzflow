/**
 * The user's local calendar date, as YYYY-MM-DD.
 *
 * Every murajaah queue is keyed to a date, and that date has to be the user's
 * own. Computing it in UTC means someone in Kuala Lumpur gets tomorrow's queue
 * at 8am and appears to lose their streak overnight — the single most common
 * complaint about this kind of feature, and the reason timezone is captured at
 * signup rather than assumed.
 */
export function localDateFor(timezone: string, at: Date = new Date()): string {
  const format = (tz: string) =>
    // en-CA formats as YYYY-MM-DD, exactly the shape a date column wants.
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);

  try {
    return format(timezone);
  } catch {
    return format('UTC');
  }
}

/** Human phrasing for how long ago a page was last reviewed. */
export function lastReviewedLabel(days: number | null): string {
  if (days === null) return 'Never reviewed';
  if (days <= 0) return 'Reviewed today';
  if (days === 1) return 'Reviewed yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return 'Over a year ago';
}

/**
 * Whether a given local date falls on one of the plan's rest days.
 *
 * The date string is parsed as UTC deliberately: it is already a local
 * calendar date, so re-interpreting it in a timezone would shift it by a day.
 * `getUTCDay` then returns 0 for Sunday, matching `extract(dow)` in Postgres
 * and the values stored in `rest_days`.
 */
export function isRestDay(
  localDate: string,
  restDays: readonly number[]
): boolean {
  if (restDays.length === 0) return false;
  const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay();
  return restDays.includes(weekday);
}
