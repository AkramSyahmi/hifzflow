/**
 * Maps memorisation coverage onto the five-step density ramp defined in
 * globals.css (--hifz-0 through --hifz-4).
 *
 * The top step is reserved for fully complete rather than being one band among
 * five. A page that is 99 percent memorised is materially different from one
 * that is finished, and the grid has to make that difference visible at a
 * glance or it is useless for deciding what to work on next.
 */
export type DensityLevel = 0 | 1 | 2 | 3 | 4;

export function densityLevel(memorised: number, total: number): DensityLevel {
  if (total <= 0 || memorised <= 0) return 0;
  if (memorised >= total) return 4;

  const ratio = memorised / total;
  if (ratio <= 1 / 3) return 1;
  if (ratio <= 2 / 3) return 2;
  return 3;
}

const DENSITY_CLASS: Record<DensityLevel, string> = {
  0: 'bg-hifz-0',
  1: 'bg-hifz-1',
  2: 'bg-hifz-2',
  3: 'bg-hifz-3',
  4: 'bg-hifz-4',
};

export function densityClass(level: DensityLevel): string {
  return DENSITY_CLASS[level];
}

const DENSITY_VAR: Record<DensityLevel, string> = {
  0: 'var(--hifz-0)',
  1: 'var(--hifz-1)',
  2: 'var(--hifz-2)',
  3: 'var(--hifz-3)',
  4: 'var(--hifz-4)',
};

/** For SVG fills, where a Tailwind class cannot be used. */
export function densityFill(level: DensityLevel): string {
  return DENSITY_VAR[level];
}

export function densityLabel(memorised: number, total: number): string {
  if (total <= 0) return 'No ayahs';
  if (memorised <= 0) return 'Not started';
  if (memorised >= total) return 'Complete';
  return `${memorised} of ${total} ayahs`;
}
