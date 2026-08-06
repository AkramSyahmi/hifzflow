import { describe, expect, it } from 'vitest';

import { isRestDay, lastReviewedLabel, localDateFor } from './local-date';

describe('localDateFor', () => {
  it('returns the local date, not the UTC one', () => {
    // 17:30 UTC is already the next day in Kuala Lumpur (UTC+8).
    const at = new Date('2025-03-10T17:30:00Z');
    expect(localDateFor('Asia/Kuala_Lumpur', at)).toBe('2025-03-11');
    expect(localDateFor('UTC', at)).toBe('2025-03-10');
  });

  it('handles timezones behind UTC', () => {
    // 02:00 UTC is still the previous day in New York.
    const at = new Date('2025-03-10T02:00:00Z');
    expect(localDateFor('America/New_York', at)).toBe('2025-03-09');
  });

  it('always produces a zero-padded YYYY-MM-DD', () => {
    const at = new Date('2025-01-05T12:00:00Z');
    expect(localDateFor('UTC', at)).toBe('2025-01-05');
  });

  it('falls back to UTC for an unrecognised timezone', () => {
    const at = new Date('2025-03-10T12:00:00Z');
    expect(localDateFor('Not/AZone', at)).toBe('2025-03-10');
  });
});

describe('lastReviewedLabel', () => {
  it('describes the never-reviewed case', () => {
    expect(lastReviewedLabel(null)).toBe('Never reviewed');
  });

  it('describes recent reviews', () => {
    expect(lastReviewedLabel(0)).toBe('Reviewed today');
    expect(lastReviewedLabel(1)).toBe('Reviewed yesterday');
    expect(lastReviewedLabel(3)).toBe('3 days ago');
  });

  it('switches to coarser units as time passes', () => {
    expect(lastReviewedLabel(14)).toBe('2 weeks ago');
    expect(lastReviewedLabel(90)).toBe('3 months ago');
    expect(lastReviewedLabel(400)).toBe('Over a year ago');
  });
});

describe('isRestDay', () => {
  it('is false when no rest days are configured', () => {
    expect(isRestDay('2025-03-07', [])).toBe(false);
  });

  it('matches Sunday as 0, the same as extract(dow)', () => {
    // 2025-03-02 is a Sunday.
    expect(isRestDay('2025-03-02', [0])).toBe(true);
    expect(isRestDay('2025-03-03', [0])).toBe(false);
  });

  it('matches Friday as 5', () => {
    // 2025-03-07 is a Friday.
    expect(isRestDay('2025-03-07', [5])).toBe(true);
  });

  it('handles several rest days', () => {
    expect(isRestDay('2025-03-08', [5, 6])).toBe(true);
  });

  it('does not shift the date by reinterpreting it in a timezone', () => {
    // A naive local-time parse would move this to the previous day west of UTC.
    expect(isRestDay('2025-03-02', [0])).toBe(true);
  });
});
