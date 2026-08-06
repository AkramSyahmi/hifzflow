/**
 * The outbox: writes made while offline, held until they can be sent.
 *
 * IndexedDB rather than localStorage, for two reasons that both matter. It
 * survives a browser evicting page memory, and it is transactional — a queue
 * that can be half-written during a crash is worse than no queue, because the
 * user believes their work was saved.
 *
 * Replay safety comes from the database, not from here. `complete_queue_item`
 * returns the existing session when an item is already complete, and
 * `record_pages` inserts only the gaps. Both are idempotent, so sending a
 * queued write twice is harmless. That is what makes replay tractable at all;
 * without it this would need server-side deduplication keys.
 */

const DB_NAME = 'hifzflow';
const DB_VERSION = 1;
const STORE = 'outbox';

/** Every write the outbox knows how to replay. */
export type OutboxKind = 'complete-review' | 'toggle-page';

export interface OutboxEntry {
  /** Client-generated, so an entry can be referenced before it is sent. */
  id: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

function isBrowser(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        // Replay must happen in the order the user acted, so a later rating
        // cannot be overwritten by an earlier one arriving after it.
        store.createIndex('createdAt', 'createdAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      })
  );
}

/** Adds a write to the outbox. Returns the stored entry. */
export async function enqueue(
  kind: OutboxKind,
  payload: Record<string, unknown>
): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    id: crypto.randomUUID(),
    kind,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };

  if (!isBrowser()) return entry;

  await transact('readwrite', (store) => store.add(entry));
  return entry;
}

/** Everything waiting, oldest first. */
export async function pending(): Promise<OutboxEntry[]> {
  if (!isBrowser()) return [];

  const all = await transact<OutboxEntry[]>(
    'readonly',
    (store) => store.getAll() as IDBRequest<OutboxEntry[]>
  );
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function count(): Promise<number> {
  if (!isBrowser()) return 0;
  return transact<number>('readonly', (store) => store.count());
}

/** Removes an entry once it has been accepted by the server. */
export async function remove(id: string): Promise<void> {
  if (!isBrowser()) return;
  await transact(
    'readwrite',
    (store) => store.delete(id) as IDBRequest<undefined>
  );
}

/**
 * Records a failed attempt.
 *
 * The entry is kept rather than dropped: a failure is usually the network, and
 * discarding the user's work because the first retry did not land would be the
 * worst possible behaviour. `MAX_ATTEMPTS` exists so a genuinely bad entry
 * cannot block the queue forever.
 */
export const MAX_ATTEMPTS = 5;

export async function recordFailure(
  id: string,
  message: string
): Promise<OutboxEntry | null> {
  if (!isBrowser()) return null;

  const existing = await transact<OutboxEntry | undefined>(
    'readonly',
    (store) => store.get(id) as IDBRequest<OutboxEntry | undefined>
  );
  if (!existing) return null;

  const updated: OutboxEntry = {
    ...existing,
    attempts: existing.attempts + 1,
    lastError: message,
  };

  if (updated.attempts >= MAX_ATTEMPTS) {
    await remove(id);
    return null;
  }

  await transact('readwrite', (store) => store.put(updated));
  return updated;
}

/** Empties the outbox. Used when a user abandons queued work deliberately. */
export async function clear(): Promise<void> {
  if (!isBrowser()) return;
  await transact(
    'readwrite',
    (store) => store.clear() as IDBRequest<undefined>
  );
}
