import { describe, expect, it } from 'vitest';

import {
  deleteAccountSchema,
  profileSchema,
  remindersSchema,
} from './settings-schemas';

describe('profileSchema', () => {
  it('accepts a valid name and timezone', () => {
    const result = profileSchema.safeParse({
      displayName: 'Zainab',
      timezone: 'Asia/Kuala_Lumpur',
    });
    expect(result.success).toBe(true);
  });

  it('trims the name', () => {
    const result = profileSchema.parse({
      displayName: '  Zainab  ',
      timezone: 'UTC',
    });
    expect(result.displayName).toBe('Zainab');
  });

  it('rejects an empty name', () => {
    expect(
      profileSchema.safeParse({ displayName: '   ', timezone: 'UTC' }).success
    ).toBe(false);
  });

  it('rejects a timezone the runtime does not know', () => {
    expect(
      profileSchema.safeParse({ displayName: 'Zainab', timezone: 'Mars/Base' })
        .success
    ).toBe(false);
  });
});

describe('remindersSchema', () => {
  it('accepts a 24-hour time', () => {
    expect(
      remindersSchema.safeParse({ enabled: true, time: '05:30', days: [1, 2] })
        .success
    ).toBe(true);
  });

  it('accepts midnight and the last minute of the day', () => {
    for (const time of ['00:00', '23:59']) {
      expect(
        remindersSchema.safeParse({ enabled: true, time, days: [] }).success
      ).toBe(true);
    }
  });

  it('rejects an invalid hour or a 12-hour format', () => {
    for (const time of ['24:00', '5:30', '05:60', '5.30pm']) {
      expect(
        remindersSchema.safeParse({ enabled: true, time, days: [] }).success
      ).toBe(false);
    }
  });

  it('rejects a weekday outside 0-6', () => {
    expect(
      remindersSchema.safeParse({ enabled: true, time: '05:30', days: [7] })
        .success
    ).toBe(false);
  });
});

describe('deleteAccountSchema', () => {
  it('requires the exact phrase', () => {
    expect(
      deleteAccountSchema.safeParse({ confirmation: 'delete my account' })
        .success
    ).toBe(true);
  });

  it('is case insensitive but otherwise exact', () => {
    expect(
      deleteAccountSchema.safeParse({ confirmation: 'Delete My Account' })
        .success
    ).toBe(true);
    expect(
      deleteAccountSchema.safeParse({ confirmation: 'delete account' }).success
    ).toBe(false);
  });

  it('tolerates surrounding whitespace', () => {
    expect(
      deleteAccountSchema.safeParse({ confirmation: '  delete my account  ' })
        .success
    ).toBe(true);
  });

  it('rejects anything else, including empty input', () => {
    for (const confirmation of ['', 'yes', 'DELETE']) {
      expect(deleteAccountSchema.safeParse({ confirmation }).success).toBe(
        false
      );
    }
  });
});
