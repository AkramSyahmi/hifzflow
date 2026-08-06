'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { togglePageAction } from '@/features/memorisation/actions/memorisation-actions';
import { completeItemAction } from '@/features/murajaah/actions/murajaah-actions';

import {
  count as outboxCount,
  enqueue,
  pending,
  recordFailure,
  remove,
  type OutboxEntry,
  type OutboxKind,
} from '../lib/outbox';
import { useOnline } from './use-online';

/**
 * Sends a queued write.
 *
 * Kept in one place so the mapping from stored payload to Server Action stays
 * explicit. An entry whose kind is not recognised — a queue written by an older
 * version of the app — is dropped rather than retried forever.
 */
async function send(entry: OutboxEntry): Promise<boolean> {
  switch (entry.kind) {
    case 'complete-review': {
      const result = await completeItemAction(entry.payload);
      return result.success;
    }
    case 'toggle-page': {
      const result = await togglePageAction(entry.payload);
      return result.success;
    }
    default:
      return true;
  }
}

export interface OutboxState {
  online: boolean;
  queued: number;
  flushing: boolean;
  queue: (kind: OutboxKind, payload: Record<string, unknown>) => Promise<void>;
  flush: () => Promise<void>;
}

export function useOutbox(): OutboxState {
  const online = useOnline();
  const router = useRouter();
  const [queued, setQueued] = useState(0);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(async () => {
    setQueued(await outboxCount());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const flush = useCallback(async () => {
    const entries = await pending();
    if (entries.length === 0) return;

    setFlushing(true);
    let sent = 0;

    // Sequential, not parallel. These are ordered user actions, and firing them
    // together would let a later rating land before an earlier one.
    for (const entry of entries) {
      try {
        const ok = await send(entry);
        if (ok) {
          await remove(entry.id);
          sent += 1;
        } else {
          await recordFailure(entry.id, 'rejected');
        }
      } catch (error) {
        await recordFailure(
          entry.id,
          error instanceof Error ? error.message : 'unknown'
        );
        // Stop on the first transport failure. The rest will fail the same way,
        // and burning their attempt counts would discard good work.
        break;
      }
    }

    await refresh();
    setFlushing(false);

    if (sent > 0) router.refresh();
  }, [refresh, router]);

  // Replay as soon as the connection returns.
  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);

  const queue = useCallback(
    async (kind: OutboxKind, payload: Record<string, unknown>) => {
      await enqueue(kind, payload);
      await refresh();
    },
    [refresh]
  );

  return { online, queued, flushing, queue, flush };
}
