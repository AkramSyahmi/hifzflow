/**
 * Public client-safe surface of the offline feature.
 * There is no server surface: everything here runs in the browser.
 */
export { OfflineBanner } from './components/offline-banner';
export { ServiceWorkerRegistrar } from './components/service-worker-registrar';
export { useOnline } from './hooks/use-online';
export { useOutbox } from './hooks/use-outbox';
export {
  clear as clearOutbox,
  count as outboxCount,
  enqueue as enqueueWrite,
  MAX_ATTEMPTS,
  pending as pendingWrites,
  type OutboxEntry,
  type OutboxKind,
} from './lib/outbox';
