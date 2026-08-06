/**
 * Server-only surface of the analytics feature.
 * Never imported from a Client Component.
 */
export {
  getActivityCalendar,
  getActivitySummary,
  type ActivitySummary,
} from './queries/get-activity';
export {
  getMemorisationGrowth,
  getMostReviewedPages,
  getReviewTotals,
  getReviewTrend,
  getStrongestPages,
  getWeakestPages,
  type GrowthPoint,
  type PageStrength,
  type ReviewTotals,
  type ReviewTrendPoint,
} from './queries/get-analytics';
