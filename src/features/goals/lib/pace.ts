import type { Views } from '@/lib/supabase/database.types';

export type GoalProgress = Views<'v_goal_progress'>;
export type GoalState = GoalProgress['state'];

/**
 * Presentation logic for goal state.
 *
 * The wording matters more than usual here. A goal that makes encouraging
 * noises while someone has recorded nothing for three weeks is worse than no
 * goal at all — it turns a missed target into a surprise. Every message below
 * states the position plainly and, where there is one, names the specific
 * thing that would change it.
 */

export const STATE_LABEL: Record<GoalState, string> = {
  complete: 'Complete',
  on_track: 'On track',
  behind: 'Behind',
  stalled: 'Stalled',
  overdue: 'Past target',
  abandoned: 'Abandoned',
};

export const STATE_VARIANT: Record<
  GoalState,
  'memorised' | 'learning' | 'weak' | 'secondary' | 'outline'
> = {
  complete: 'memorised',
  on_track: 'memorised',
  behind: 'weak',
  stalled: 'weak',
  overdue: 'outline',
  abandoned: 'outline',
};

/** Ayahs per day expressed as pages, using the scope's own ayah density. */
export function ayahsPerDayAsPages(
  ayahsPerDay: number,
  scopeAyahs: number,
  scopePages: number
): number {
  if (scopePages <= 0 || scopeAyahs <= 0) return 0;
  const ayahsPerPage = scopeAyahs / scopePages;
  return Math.round((ayahsPerDay / ayahsPerPage) * 10) / 10;
}

/**
 * The one-line assessment shown under a goal.
 *
 * Returns null where the headline figures already say everything, so a card is
 * never padded with a sentence that repeats the numbers above it.
 */
export function paceMessage(goal: GoalProgress): string | null {
  const { state, remaining_ayahs, days_remaining, recent_ayahs_per_day } = goal;

  switch (state) {
    case 'complete':
    case 'abandoned':
      return null;

    case 'stalled':
      return remaining_ayahs > 0
        ? 'Nothing recorded in the last two weeks, so there is no pace to project from. Record whatever you manage today and the projection returns.'
        : null;

    case 'overdue':
      return `The target date has passed with ${remaining_ayahs.toLocaleString('en')} ayahs left. Setting a new date from where you actually are is more useful than carrying this one forward.`;

    case 'behind': {
      const needed = days_remaining > 0 ? remaining_ayahs / days_remaining : 0;
      const multiple =
        recent_ayahs_per_day > 0
          ? Math.round((needed / recent_ayahs_per_day) * 10) / 10
          : null;
      return multiple
        ? `Reaching this date needs about ${multiple}× your current pace. Either the pace rises or the date moves — both are legitimate, but the date will not move itself.`
        : 'The current pace does not reach this date.';
    }

    case 'on_track': {
      if (days_remaining <= 0) return null;
      const daysNeeded = Math.ceil(
        remaining_ayahs / Math.max(recent_ayahs_per_day, 0.1)
      );
      const spare = Math.max(0, days_remaining - daysNeeded);
      return `At your current pace this finishes with about ${spare} days to spare.`;
    }

    default:
      return null;
  }
}

/** Short human description of a goal's scope. */
export function scopeLabel(goal: {
  scope_type: GoalProgress['scope_type'];
  scope_from: number | null;
  scope_to: number | null;
}): string {
  const { scope_type: type, scope_from: from, scope_to: to } = goal;

  if (type === 'quran') return 'The whole Quran';

  const isSpan = to !== null && to !== from;
  const span = isSpan ? `${from}–${to}` : `${from}`;

  switch (type) {
    case 'juz':
      return `Juz' ${span}`;
    case 'surah':
      return isSpan ? `Surahs ${span}` : `Surah ${from}`;
    case 'pages':
      return isSpan ? `Pages ${span}` : `Page ${from}`;
    case 'ayahs':
      return `Ayahs ${span}`;
    default:
      return 'Custom range';
  }
}
