import { TOTAL_AYAHS } from '@/lib/constants';

/**
 * Ayah range utilities.
 *
 * PostgreSQL normalises int4range to the half-open form `[start, end)`, and
 * PostgREST serialises it as the string `"[1,8)"`. A person reading a mushaf
 * thinks in inclusive terms: ayahs 1 to 7. Every conversion between those two
 * worlds happens here and nowhere else, because an off-by-one that leaks into
 * feature code is close to impossible to spot by reading it.
 */

/** An inclusive range of global ayah ids, as a human would state it. */
export interface AyahRange {
  /** First ayah, inclusive. 1-based. */
  start: number;
  /** Last ayah, inclusive. */
  end: number;
}

export class AyahRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AyahRangeError';
  }
}

/** True when the value is a whole number inside the canonical index. */
export function isAyahId(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= TOTAL_AYAHS
  );
}

/**
 * Builds an inclusive range, rejecting anything outside the canonical index.
 * Bounds given the wrong way round are a caller error rather than something to
 * silently reorder: it usually means two variables were swapped.
 */
export function createRange(start: number, end: number): AyahRange {
  if (!isAyahId(start)) {
    throw new AyahRangeError(`Start ayah ${start} is outside 1-${TOTAL_AYAHS}`);
  }
  if (!isAyahId(end)) {
    throw new AyahRangeError(`End ayah ${end} is outside 1-${TOTAL_AYAHS}`);
  }
  if (start > end) {
    throw new AyahRangeError(`Range start ${start} is after its end ${end}`);
  }
  return { start, end };
}

/**
 * Parses the range literal PostgREST returns, for example `"[1,8)"`.
 *
 * Handles all four bound styles rather than assuming the canonical `[)`,
 * because a range constructed in SQL with explicit bounds can arrive in any
 * form and quietly shifting by one here would corrupt progress counts.
 */
export function parseRange(literal: string): AyahRange {
  const match = /^(\[|\()\s*(-?\d+)\s*,\s*(-?\d+)\s*(\]|\))$/.exec(
    literal.trim()
  );

  if (!match) {
    throw new AyahRangeError(`Cannot parse range literal "${literal}"`);
  }

  const [, lowerBound, rawLower, rawUpper, upperBound] = match;

  const lower = Number(rawLower);
  const upper = Number(rawUpper);

  const start = lowerBound === '[' ? lower : lower + 1;
  const end = upperBound === ']' ? upper : upper - 1;

  if (start > end) {
    throw new AyahRangeError(`Range literal "${literal}" is empty`);
  }

  return createRange(start, end);
}

/** Serialises to the inclusive literal PostgreSQL accepts on the way in. */
export function toRangeLiteral(range: AyahRange): string {
  return `[${range.start},${range.end}]`;
}

/** Number of ayahs the range covers. */
export function rangeLength(range: AyahRange): number {
  return range.end - range.start + 1;
}

/** True when the ayah falls inside the range. */
export function rangeContains(range: AyahRange, ayahId: number): boolean {
  return ayahId >= range.start && ayahId <= range.end;
}

/** True when the two ranges share at least one ayah. */
export function rangesOverlap(a: AyahRange, b: AyahRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** True when the ranges touch end to end with no gap between them. */
export function rangesAdjacent(a: AyahRange, b: AyahRange): boolean {
  return a.end + 1 === b.start || b.end + 1 === a.start;
}

/** Total ayahs covered by a list of ranges, counting overlaps only once. */
export function totalAyahs(ranges: readonly AyahRange[]): number {
  return mergeRanges(ranges).reduce((sum, r) => sum + rangeLength(r), 0);
}

/**
 * Merges overlapping and adjacent ranges into the smallest equivalent set.
 *
 * The database already guarantees stored segments do not overlap, so this is
 * for display: three consecutive segments should read as one span rather than
 * three, and a progress bar should not double-count.
 */
export function mergeRanges(ranges: readonly AyahRange[]): AyahRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: AyahRange[] = [];

  for (const current of sorted) {
    const last = merged[merged.length - 1];

    if (
      last &&
      (rangesOverlap(last, current) || rangesAdjacent(last, current))
    ) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Removes `hole` from `range`, returning what remains.
 *
 * Used when a user un-marks part of something they had recorded. Splitting a
 * span down the middle leaves two pieces, which is why this returns an array.
 */
export function subtractRange(range: AyahRange, hole: AyahRange): AyahRange[] {
  if (!rangesOverlap(range, hole)) return [{ ...range }];

  const remainder: AyahRange[] = [];

  if (hole.start > range.start) {
    remainder.push({ start: range.start, end: hole.start - 1 });
  }
  if (hole.end < range.end) {
    remainder.push({ start: hole.end + 1, end: range.end });
  }

  return remainder;
}

/** Inverts a set of ranges within a bounding range: what is *not* covered. */
export function gapsWithin(
  bounds: AyahRange,
  covered: readonly AyahRange[]
): AyahRange[] {
  const merged = mergeRanges(covered).filter((r) => rangesOverlap(bounds, r));
  const gaps: AyahRange[] = [];
  let cursor = bounds.start;

  for (const range of merged) {
    if (range.start > cursor) {
      gaps.push({ start: cursor, end: Math.min(range.start - 1, bounds.end) });
    }
    cursor = Math.max(cursor, range.end + 1);
    if (cursor > bounds.end) break;
  }

  if (cursor <= bounds.end) {
    gaps.push({ start: cursor, end: bounds.end });
  }

  return gaps;
}
