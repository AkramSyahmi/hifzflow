import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  clear,
  count,
  enqueue,
  MAX_ATTEMPTS,
  pending,
  recordFailure,
  remove,
} from './outbox';

beforeEach(async () => {
  await clear();
});

describe('enqueue', () => {
  it('stores an entry with an id and a timestamp', async () => {
    const entry = await enqueue('toggle-page', { page: 5, memorised: true });

    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.kind).toBe('toggle-page');
    expect(entry.attempts).toBe(0);
    expect(entry.createdAt).toBeGreaterThan(0);
  });

  it('makes the entry readable back', async () => {
    await enqueue('toggle-page', { page: 5, memorised: true });
    const queued = await pending();

    expect(queued).toHaveLength(1);
    expect(queued[0]?.payload).toEqual({ page: 5, memorised: true });
  });

  it('keeps several entries', async () => {
    await enqueue('toggle-page', { page: 1 });
    await enqueue('toggle-page', { page: 2 });
    await enqueue('complete-review', { itemId: 'a', confidence: 4 });

    expect(await count()).toBe(3);
  });
});

describe('pending', () => {
  it('returns entries oldest first, because replay order matters', async () => {
    const first = await enqueue('complete-review', { itemId: 'a' });
    // Distinct timestamps, since two writes in the same millisecond would make
    // the ordering assertion meaningless.
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await enqueue('complete-review', { itemId: 'b' });

    const queued = await pending();
    expect(queued.map((entry) => entry.id)).toEqual([first.id, second.id]);
  });

  it('is empty to begin with', async () => {
    expect(await pending()).toEqual([]);
  });
});

describe('remove', () => {
  it('drops an accepted entry', async () => {
    const entry = await enqueue('toggle-page', { page: 9 });
    await remove(entry.id);

    expect(await count()).toBe(0);
  });

  it('ignores an id that is not present', async () => {
    await expect(remove('missing')).resolves.toBeUndefined();
  });
});

describe('recordFailure', () => {
  it('keeps the entry and increments the attempt count', async () => {
    const entry = await enqueue('toggle-page', { page: 3 });
    const updated = await recordFailure(entry.id, 'network down');

    expect(updated?.attempts).toBe(1);
    expect(updated?.lastError).toBe('network down');
    expect(await count()).toBe(1);
  });

  it('retains the payload across a failure', async () => {
    const entry = await enqueue('toggle-page', { page: 3, memorised: false });
    await recordFailure(entry.id, 'offline');

    const queued = await pending();
    expect(queued[0]?.payload).toEqual({ page: 3, memorised: false });
  });

  it('drops an entry that has exhausted its attempts', async () => {
    const entry = await enqueue('toggle-page', { page: 3 });

    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      const updated = await recordFailure(entry.id, 'still failing');
      expect(updated?.attempts).toBe(attempt);
    }

    // The attempt that reaches the ceiling removes it, so one bad entry cannot
    // block the queue forever.
    const final = await recordFailure(entry.id, 'giving up');
    expect(final).toBeNull();
    expect(await count()).toBe(0);
  });

  it('returns null for an unknown id', async () => {
    expect(await recordFailure('missing', 'whatever')).toBeNull();
  });
});

describe('clear', () => {
  it('empties everything', async () => {
    await enqueue('toggle-page', { page: 1 });
    await enqueue('toggle-page', { page: 2 });
    await clear();

    expect(await count()).toBe(0);
  });
});
