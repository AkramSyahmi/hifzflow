/**
 * Public client-safe surface of the goals feature.
 * Server-only exports live in `./server`.
 */
export { CreateGoalDialog } from './components/create-goal-dialog';
export { GoalCard } from './components/goal-card';
export {
  ayahsPerDayAsPages,
  paceMessage,
  scopeLabel,
  STATE_LABEL,
  STATE_VARIANT,
  type GoalProgress,
  type GoalState,
} from './lib/pace';
