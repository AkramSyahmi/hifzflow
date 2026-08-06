import { describe, expect, it } from 'vitest';

import { activityLabel, activityLevel, monthLabels, toWeeks } from './activity';

const day = (date: string, reviews = 0, memorised = 0) => ({
  day: date,
  review_count: reviews,
  ayahs_reviewed: reviews * 15,
  ayahs_memorised: memorised,
});

describe('activityLevel', () => {
  it('is 0 for a completely empty day', () => {
    expect(activityLevel(day('2025-03-01'))).toBe(0);
  });

  it('counts memorisation as activity even with no review', () => {
    expect(activityLevel(day('2025-03-01', 0, 12))).toBe(1);
  });

  it('bands review counts', () => {
    expect(activityLevel(day('2025-03-01', 1))).toBe(1);
    expect(activityLevel(day('2025-03-01', 2))).toBe(1);
    expect(activityLevel(day('2025-03-01', 3))).toBe(2);
    expect(activityLevel(day('2025-03-01', 5))).toBe(2);
    expect(activityLevel(day('2025-03-01', 6))).toBe(3);
    expect(activityLevel(day('2025-03-01', 10))).toBe(3);
    expect(activityLevel(day('2025-03-01', 11))).toBe(4);
    expect(activityLevel(day('2025-03-01', 40))).toBe(4);
  });
});

describe('activityLabel', () => {
  it('describes an empty day', () => {
    expect(activityLabel(day('2025-03-01'))).toBe('No activity');
  });

  it('describes reviews alone', () => {
    expect(activityLabel(day('2025-03-01', 1))).toBe('1 page reviewed');
    expect(activityLabel(day('2025-03-01', 4))).toBe('4 pages reviewed');
  });

  it('describes both kinds of activity', () => {
    expect(activityLabel(day('2025-03-01', 3, 20))).toBe(
      '3 pages reviewed, 20 ayahs memorised'
    );
  });
});

describe('toWeeks', () => {
  it('returns nothing for an empty range', () => {
    expect(toWeeks([])).toEqual([]);
  });

  it('pads the first week so columns are always seven tall', () => {
    // 2025-03-05 is a Wednesday, so three blanks precede it.
    const weeks = toWeeks([day('2025-03-05'), day('2025-03-06')]);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[0]?.slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0]?.[3]?.day).toBe('2025-03-05');
  });

  it('pads the final week too', () => {
    const days = Array.from({ length: 10 }, (_, i) =>
      day(`2025-03-${String(i + 2).padStart(2, '0')}`)
    );
    const weeks = toWeeks(days);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('starts a new column on each Sunday', () => {
    // 2025-03-02 is a Sunday.
    const days = Array.from({ length: 14 }, (_, i) =>
      day(`2025-03-${String(i + 2).padStart(2, '0')}`)
    );
    const weeks = toWeeks(days);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]?.[0]?.day).toBe('2025-03-02');
    expect(weeks[1]?.[0]?.day).toBe('2025-03-09');
  });
});

describe('monthLabels', () => {
  it('labels each month once', () => {
    const days = Array.from({ length: 70 }, (_, i) => {
      const date = new Date(Date.UTC(2025, 0, 5 + i));
      return day(date.toISOString().slice(0, 10));
    });
    const labels = monthLabels(toWeeks(days));
    expect(labels.map((l) => l.label)).toEqual(['Jan', 'Feb', 'Mar']);
  });

  it('suppresses labels that would collide', () => {
    // A range this short would place two labels within three columns.
    const days = Array.from({ length: 10 }, (_, i) => {
      const date = new Date(Date.UTC(2025, 0, 28 + i));
      return day(date.toISOString().slice(0, 10));
    });
    const labels = monthLabels(toWeeks(days));
    expect(labels).toHaveLength(1);
  });
});
