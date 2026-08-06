/**
 * Public client-safe surface of the analytics feature.
 * Server-only exports live in `./server`.
 */
export { ActivityHeatmap } from './components/activity-heatmap';
export { GrowthChart } from './components/growth-chart';
export { PageStrengthList } from './components/page-strength-list';
export { ReviewTrendChart } from './components/review-trend-chart';
export { StatGrid, type Stat } from './components/stat-grid';
export {
  activityLabel,
  activityLevel,
  monthLabels,
  toWeeks,
  type ActivityDay,
} from './lib/activity';
