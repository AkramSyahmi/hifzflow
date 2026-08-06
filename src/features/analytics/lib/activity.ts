import type { DensityLevel } from '@/features/memorisation';

export interface ActivityDay {
  day: string;
  review_count: number;
  ayahs_reviewed: number;
  ayahs_memorised: number;
}

/**
 * Maps a day's activity onto the shared density ramp.
 *
 * Thresholds are absolute rather than relative to the user's own average. A
 * relative scale re-shades the entire history every time someone has a heavy
 * week, so a year-old square changes colour for no reason the user can see.
 *
 * A day with memorisation but no review still counts: recording new material
 * is activity, and showing it as blank would misrepresent the day.
 */
export function activityLevel(day: ActivityDay): DensityLevel {
  const { review_count: reviews, ayahs_memorised: memorised } = day;

  if (reviews <= 0) return memorised > 0 ? 1 : 0;
  if (reviews <= 2) return 1;
  if (reviews <= 5) return 2;
  if (reviews <= 10) return 3;
  return 4;
}

export function activityLabel(day: ActivityDay): string {
  const parts: string[] = [];
  if (day.review_count > 0) {
    parts.push(
      `${day.review_count} page${day.review_count === 1 ? '' : 's'} reviewed`
    );
  }
  if (day.ayahs_memorised > 0) {
    parts.push(`${day.ayahs_memorised} ayahs memorised`);
  }
  return parts.length > 0 ? parts.join(', ') : 'No activity';
}

/**
 * Groups days into calendar weeks starting on Sunday.
 *
 * The first and last weeks are padded with nulls so every column has seven
 * cells, which keeps the grid rectangular regardless of which weekday the
 * range begins on.
 */
export function toWeeks(
  days: readonly ActivityDay[]
): (ActivityDay | null)[][] {
  if (days.length === 0) return [];

  const weeks: (ActivityDay | null)[][] = [];
  let current: (ActivityDay | null)[] = [];

  const firstDay = days[0];
  if (!firstDay) return [];

  const leadingBlanks = new Date(`${firstDay.day}T00:00:00Z`).getUTCDay();
  for (let i = 0; i < leadingBlanks; i += 1) current.push(null);

  for (const day of days) {
    current.push(day);
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    while (current.length < 7) current.push(null);
    weeks.push(current);
  }

  return weeks;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Column index of the first week in which each month appears. */
export function monthLabels(
  weeks: readonly (ActivityDay | null)[][]
): { label: string; column: number }[] {
  const labels: { label: string; column: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, column) => {
    const firstReal = week.find((day): day is ActivityDay => day !== null);
    if (!firstReal) return;

    const month = new Date(`${firstReal.day}T00:00:00Z`).getUTCMonth();
    if (month !== lastMonth) {
      // Skip a label that would collide with the previous one.
      const previous = labels[labels.length - 1];
      if (!previous || column - previous.column >= 3) {
        labels.push({ label: MONTHS[month] ?? '', column });
      }
      lastMonth = month;
    }
  });

  return labels;
}
