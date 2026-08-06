/**
 * Server-only surface of the memorisation feature.
 * Never imported from a Client Component.
 */
export {
  getJuzProgress,
  getPageProgress,
  getSegments,
  getSummary,
  getSurahProgress,
  type JuzProgress,
  type MemorisationSegment,
  type MemorisationSummary,
  type PageProgress,
  type SurahProgress,
} from './queries/get-progress';
export { getPageStatus, type PageStatus } from './queries/get-page-status';
