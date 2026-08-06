'use client';

import { MoreHorizontal } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { deleteGoalAction, setGoalStatusAction } from '../actions/goal-actions';
import {
  ayahsPerDayAsPages,
  paceMessage,
  scopeLabel,
  STATE_LABEL,
  STATE_VARIANT,
  type GoalProgress,
} from '../lib/pace';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`));
}

function Figure({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 text-sm font-medium">{value}</p>
      {detail ? (
        <p className="tabular text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

export function GoalCard({
  goal,
  compact = false,
}: {
  goal: GoalProgress;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const message = paceMessage(goal);

  const requiredPages =
    goal.required_ayahs_per_day === null
      ? null
      : ayahsPerDayAsPages(
          goal.required_ayahs_per_day,
          goal.scope_ayahs,
          goal.scope_pages
        );

  const recentPages = ayahsPerDayAsPages(
    goal.recent_ayahs_per_day,
    goal.scope_ayahs,
    goal.scope_pages
  );

  function setStatus(status: 'completed' | 'abandoned' | 'active') {
    startTransition(async () => {
      const result = await setGoalStatusAction({ goalId: goal.id, status });
      if (!result.success) toast.error(result.error);
      else toast.success('Goal updated.');
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteGoalAction(goal.id);
      if (!result.success) toast.error(result.error);
      else toast.success('Goal removed.');
    });
  }

  return (
    <Card className={cn('gap-4', pending && 'opacity-60')}>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-display text-sm font-semibold tracking-tight">
                {goal.name}
              </h3>
              <Badge variant={STATE_VARIANT[goal.state]}>
                {STATE_LABEL[goal.state]}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {scopeLabel(goal)} · by {formatDate(goal.target_date)}
            </p>
          </div>

          {!compact ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Options for ${goal.name}`}
                  disabled={pending}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {goal.status === 'active' ? (
                  <>
                    <DropdownMenuItem onSelect={() => setStatus('completed')}>
                      Mark complete
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setStatus('abandoned')}>
                      Abandon
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onSelect={() => setStatus('active')}>
                    Reopen
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={remove}>
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="tabular font-medium">
              {goal.percent_complete}%
            </span>
            <span className="tabular text-xs text-muted-foreground">
              {goal.memorised_ayahs.toLocaleString('en')} of{' '}
              {goal.scope_ayahs.toLocaleString('en')} ayahs
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                goal.state === 'complete'
                  ? 'bg-state-memorised'
                  : goal.state === 'behind' || goal.state === 'stalled'
                    ? 'bg-state-weak'
                    : 'bg-hifz-3'
              )}
              style={{ width: `${Math.min(100, goal.percent_complete)}%` }}
            />
          </div>
          {goal.baseline_ayahs > 0 ? (
            <p className="text-xs text-muted-foreground">
              {goal.baseline_ayahs.toLocaleString('en')} ayahs were already
              memorised when this goal was set.
            </p>
          ) : null}
        </div>

        {goal.state !== 'complete' && goal.state !== 'abandoned' ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure
              label="Needed"
              value={
                requiredPages === null ? '—' : `${requiredPages} pages/day`
              }
              detail={
                goal.required_ayahs_per_day === null
                  ? 'Date has passed'
                  : `${goal.required_ayahs_per_day} ayahs`
              }
            />
            <Figure
              label="Current pace"
              value={`${recentPages} pages/day`}
              detail={`${goal.recent_ayahs_per_day} ayahs · 14 day average`}
            />
            <Figure
              label="Days left"
              value={
                goal.days_remaining > 0 ? String(goal.days_remaining) : '0'
              }
              detail={`of ${goal.days_total}`}
            />
            <Figure
              label="Projected"
              value={
                goal.projected_completion_date
                  ? formatDate(goal.projected_completion_date)
                  : 'No date'
              }
              detail={
                goal.projected_completion_date
                  ? 'at current pace'
                  : 'pace is zero'
              }
            />
          </div>
        ) : null}

        {message ? (
          <p
            className={cn(
              'text-sm leading-relaxed',
              goal.state === 'behind' ||
                goal.state === 'stalled' ||
                goal.state === 'overdue'
                ? 'text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
