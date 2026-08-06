import { describe, expect, it } from 'vitest';

import { initialsFrom } from './initials';

describe('initialsFrom', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsFrom('Muhammad Akram', undefined)).toBe('MA');
  });

  it('takes two letters when there is a single word', () => {
    expect(initialsFrom('Akram', undefined)).toBe('AK');
  });

  it('splits on dots, underscores and hyphens', () => {
    expect(initialsFrom(null, 'akram.syahmi@example.com')).toBe('AS');
  });

  it('falls back to the email local part when there is no name', () => {
    expect(initialsFrom(null, 'huffaz@example.com')).toBe('HU');
  });

  it('ignores a name that is only whitespace', () => {
    expect(initialsFrom('   ', 'reader@example.com')).toBe('RE');
  });

  it('returns a placeholder when there is nothing to work with', () => {
    expect(initialsFrom(null, undefined)).toBe('?');
  });
});
