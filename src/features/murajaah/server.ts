/**
 * Server-only surface of the murajaah feature.
 * Never imported from a Client Component.
 */
export {
  getOverdue,
  getPlan,
  getRecentSessions,
  getStreak,
  getTodayQueue,
  getWeakPages,
  type PageReviewState,
  type QueueItem,
  type ReviewPlan,
  type ReviewSession,
  type ReviewStreak,
} from './queries/get-murajaah';

/**
 * Re-exported so route components can resolve the user's local date without
 * importing from the client-safe barrel, which would be a confusing mix of
 * surfaces in a Server Component.
 */
export { localDateFor as localDateForRequest } from './lib/local-date';
