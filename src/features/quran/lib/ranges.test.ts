import { describe, expect, it } from 'vitest';

import {
  AyahRangeError,
  createRange,
  gapsWithin,
  isAyahId,
  mergeRanges,
  parseRange,
  rangeContains,
  rangeLength,
  rangesAdjacent,
  rangesOverlap,
  subtractRange,
  toRangeLiteral,
  totalAyahs,
} from './ranges';

describe('isAyahId', () => {
  it('accepts the first and last ayah', () => {
    expect(isAyahId(1)).toBe(true);
    expect(isAyahId(6236)).toBe(true);
  });

  it('rejects values outside the index', () => {
    expect(isAyahId(0)).toBe(false);
    expect(isAyahId(6237)).toBe(false);
    expect(isAyahId(-1)).toBe(false);
  });

  it('rejects non-integers and non-numbers', () => {
    expect(isAyahId(1.5)).toBe(false);
    expect(isAyahId(NaN)).toBe(false);
    expect(isAyahId('1')).toBe(false);
    expect(isAyahId(null)).toBe(false);
  });
});

describe('createRange', () => {
  it('builds an inclusive range', () => {
    expect(createRange(1, 7)).toEqual({ start: 1, end: 7 });
  });

  it('allows a single-ayah range', () => {
    expect(createRange(262, 262)).toEqual({ start: 262, end: 262 });
  });

  it('rejects out-of-range bounds', () => {
    expect(() => createRange(0, 7)).toThrow(AyahRangeError);
    expect(() => createRange(1, 6237)).toThrow(AyahRangeError);
  });

  it('rejects reversed bounds rather than silently reordering them', () => {
    expect(() => createRange(7, 1)).toThrow(/after its end/);
  });
});

describe('parseRange', () => {
  it('parses the canonical half-open form PostgreSQL emits', () => {
    // PostgreSQL stores ayahs 1-7 as [1,8).
    expect(parseRange('[1,8)')).toEqual({ start: 1, end: 7 });
  });

  it('parses a fully inclusive literal', () => {
    expect(parseRange('[1,7]')).toEqual({ start: 1, end: 7 });
  });

  it('parses an exclusive lower bound', () => {
    expect(parseRange('(0,8)')).toEqual({ start: 1, end: 7 });
  });

  it('parses a fully exclusive literal', () => {
    expect(parseRange('(0,8)')).toEqual({ start: 1, end: 7 });
  });

  it('tolerates whitespace', () => {
    expect(parseRange('  [ 1 , 8 )  ')).toEqual({ start: 1, end: 7 });
  });

  it('round trips through the inclusive literal', () => {
    const range = createRange(5242, 5271);
    expect(parseRange(toRangeLiteral(range))).toEqual(range);
  });

  it('rejects an unparseable literal', () => {
    expect(() => parseRange('not a range')).toThrow(AyahRangeError);
    expect(() => parseRange('empty')).toThrow(AyahRangeError);
  });

  it('rejects an empty range', () => {
    expect(() => parseRange('[5,5)')).toThrow(/empty/);
  });
});

describe('rangeLength', () => {
  it('counts inclusively', () => {
    expect(rangeLength({ start: 1, end: 7 })).toBe(7);
  });

  it('counts a single ayah as one', () => {
    expect(rangeLength({ start: 262, end: 262 })).toBe(1);
  });

  it('counts the whole Quran', () => {
    expect(rangeLength({ start: 1, end: 6236 })).toBe(6236);
  });
});

describe('rangeContains', () => {
  const range = { start: 10, end: 20 };

  it('includes both endpoints', () => {
    expect(rangeContains(range, 10)).toBe(true);
    expect(rangeContains(range, 20)).toBe(true);
  });

  it('excludes ayahs just outside', () => {
    expect(rangeContains(range, 9)).toBe(false);
    expect(rangeContains(range, 21)).toBe(false);
  });
});

describe('rangesOverlap', () => {
  it('detects a partial overlap', () => {
    expect(rangesOverlap({ start: 1, end: 10 }, { start: 5, end: 15 })).toBe(
      true
    );
  });

  it('detects a single shared ayah', () => {
    expect(rangesOverlap({ start: 1, end: 10 }, { start: 10, end: 20 })).toBe(
      true
    );
  });

  it('reports adjacent ranges as not overlapping', () => {
    expect(rangesOverlap({ start: 1, end: 10 }, { start: 11, end: 20 })).toBe(
      false
    );
  });

  it('is symmetric', () => {
    const a = { start: 1, end: 10 };
    const b = { start: 5, end: 15 };
    expect(rangesOverlap(a, b)).toBe(rangesOverlap(b, a));
  });
});

describe('rangesAdjacent', () => {
  it('detects adjacency in both directions', () => {
    expect(rangesAdjacent({ start: 1, end: 10 }, { start: 11, end: 20 })).toBe(
      true
    );
    expect(rangesAdjacent({ start: 11, end: 20 }, { start: 1, end: 10 })).toBe(
      true
    );
  });

  it('reports a gap as not adjacent', () => {
    expect(rangesAdjacent({ start: 1, end: 10 }, { start: 12, end: 20 })).toBe(
      false
    );
  });
});

describe('mergeRanges', () => {
  it('returns nothing for an empty list', () => {
    expect(mergeRanges([])).toEqual([]);
  });

  it('merges overlapping ranges', () => {
    expect(
      mergeRanges([
        { start: 1, end: 10 },
        { start: 5, end: 15 },
      ])
    ).toEqual([{ start: 1, end: 15 }]);
  });

  it('merges adjacent ranges into one span', () => {
    expect(
      mergeRanges([
        { start: 1, end: 7 },
        { start: 8, end: 20 },
      ])
    ).toEqual([{ start: 1, end: 20 }]);
  });

  it('keeps separated ranges apart', () => {
    expect(
      mergeRanges([
        { start: 1, end: 7 },
        { start: 20, end: 30 },
      ])
    ).toEqual([
      { start: 1, end: 7 },
      { start: 20, end: 30 },
    ]);
  });

  it('sorts before merging', () => {
    expect(
      mergeRanges([
        { start: 20, end: 30 },
        { start: 1, end: 7 },
        { start: 8, end: 19 },
      ])
    ).toEqual([{ start: 1, end: 30 }]);
  });

  it('absorbs a range fully contained in another', () => {
    expect(
      mergeRanges([
        { start: 1, end: 100 },
        { start: 20, end: 30 },
      ])
    ).toEqual([{ start: 1, end: 100 }]);
  });

  it('does not mutate its input', () => {
    const input = [
      { start: 1, end: 10 },
      { start: 5, end: 15 },
    ];
    mergeRanges(input);
    expect(input).toEqual([
      { start: 1, end: 10 },
      { start: 5, end: 15 },
    ]);
  });
});

describe('totalAyahs', () => {
  it('sums disjoint ranges', () => {
    expect(
      totalAyahs([
        { start: 1, end: 7 },
        { start: 20, end: 29 },
      ])
    ).toBe(17);
  });

  it('counts an overlap only once', () => {
    expect(
      totalAyahs([
        { start: 1, end: 10 },
        { start: 5, end: 15 },
      ])
    ).toBe(15);
  });

  it('is zero for no ranges', () => {
    expect(totalAyahs([])).toBe(0);
  });
});

describe('subtractRange', () => {
  it('splits a range when the hole is in the middle', () => {
    expect(subtractRange({ start: 1, end: 20 }, { start: 8, end: 12 })).toEqual(
      [
        { start: 1, end: 7 },
        { start: 13, end: 20 },
      ]
    );
  });

  it('trims the front when the hole overlaps the start', () => {
    expect(subtractRange({ start: 1, end: 20 }, { start: 1, end: 5 })).toEqual([
      { start: 6, end: 20 },
    ]);
  });

  it('trims the back when the hole overlaps the end', () => {
    expect(
      subtractRange({ start: 1, end: 20 }, { start: 15, end: 30 })
    ).toEqual([{ start: 1, end: 14 }]);
  });

  it('returns nothing when the hole swallows the range', () => {
    expect(subtractRange({ start: 5, end: 10 }, { start: 1, end: 20 })).toEqual(
      []
    );
  });

  it('returns the range untouched when there is no overlap', () => {
    expect(
      subtractRange({ start: 1, end: 10 }, { start: 20, end: 30 })
    ).toEqual([{ start: 1, end: 10 }]);
  });
});

describe('gapsWithin', () => {
  it('reports the whole span when nothing is covered', () => {
    expect(gapsWithin({ start: 1, end: 10 }, [])).toEqual([
      { start: 1, end: 10 },
    ]);
  });

  it('reports nothing when the span is fully covered', () => {
    expect(gapsWithin({ start: 1, end: 10 }, [{ start: 1, end: 10 }])).toEqual(
      []
    );
  });

  it('finds a gap in the middle', () => {
    expect(
      gapsWithin({ start: 1, end: 20 }, [
        { start: 1, end: 7 },
        { start: 13, end: 20 },
      ])
    ).toEqual([{ start: 8, end: 12 }]);
  });

  it('finds leading and trailing gaps', () => {
    expect(gapsWithin({ start: 1, end: 20 }, [{ start: 5, end: 15 }])).toEqual([
      { start: 1, end: 4 },
      { start: 16, end: 20 },
    ]);
  });

  it('ignores coverage that falls outside the bounds', () => {
    expect(
      gapsWithin({ start: 10, end: 20 }, [
        { start: 1, end: 5 },
        { start: 12, end: 14 },
      ])
    ).toEqual([
      { start: 10, end: 11 },
      { start: 15, end: 20 },
    ]);
  });

  it('handles coverage that extends past both ends', () => {
    expect(
      gapsWithin({ start: 10, end: 20 }, [{ start: 1, end: 100 }])
    ).toEqual([]);
  });
});
