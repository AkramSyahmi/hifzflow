import { describe, expect, it } from 'vitest';

import { densityClass, densityLabel, densityLevel } from './density';

describe('densityLevel', () => {
  it('is 0 when nothing is memorised', () => {
    expect(densityLevel(0, 15)).toBe(0);
  });

  it('is 4 only when the page is complete', () => {
    expect(densityLevel(15, 15)).toBe(4);
    expect(densityLevel(14, 15)).not.toBe(4);
  });

  it('treats over-coverage as complete rather than overflowing', () => {
    expect(densityLevel(20, 15)).toBe(4);
  });

  it('bands the partial range into three steps', () => {
    expect(densityLevel(1, 15)).toBe(1);
    expect(densityLevel(5, 15)).toBe(1);
    expect(densityLevel(6, 15)).toBe(2);
    expect(densityLevel(10, 15)).toBe(2);
    expect(densityLevel(11, 15)).toBe(3);
    expect(densityLevel(14, 15)).toBe(3);
  });

  it('never reports progress for a page with no ayahs', () => {
    expect(densityLevel(5, 0)).toBe(0);
  });

  it('handles negative input defensively', () => {
    expect(densityLevel(-3, 15)).toBe(0);
  });
});

describe('densityClass', () => {
  it('maps every level to a ramp token', () => {
    expect(densityClass(0)).toBe('bg-hifz-0');
    expect(densityClass(4)).toBe('bg-hifz-4');
  });
});

describe('densityLabel', () => {
  it('describes the empty, partial and complete states', () => {
    expect(densityLabel(0, 15)).toBe('Not started');
    expect(densityLabel(7, 15)).toBe('7 of 15 ayahs');
    expect(densityLabel(15, 15)).toBe('Complete');
  });
});
