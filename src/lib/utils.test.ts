import { describe, expect, it } from 'vitest';

import { cn, formatCount, toPercent } from './utils';

describe('cn', () => {
  it('merges conflicting Tailwind classes so the last one wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('drops falsy values', () => {
    expect(cn('flex', false, undefined, null, 'gap-2')).toBe('flex gap-2');
  });

  it('supports conditional object syntax', () => {
    expect(cn('base', { hidden: false, block: true })).toBe('base block');
  });
});

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(6236)).toBe('6,236');
  });

  it('leaves small numbers untouched', () => {
    expect(formatCount(7)).toBe('7');
  });
});

describe('toPercent', () => {
  it('rounds to the nearest whole percent', () => {
    expect(toPercent(302, 604)).toBe(50);
  });

  it('returns 0 when the user has no data yet', () => {
    expect(toPercent(0, 0)).toBe(0);
  });

  it('clamps values that exceed the total', () => {
    expect(toPercent(700, 604)).toBe(100);
  });

  it('clamps negative values', () => {
    expect(toPercent(-5, 604)).toBe(0);
  });
});
