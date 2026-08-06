import { Target } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireUser } from '@/features/auth/server';
import { CreateGoalDialog, GoalCard } from '@/features/goals';
import { getGoals } from '@/features/goals/server';
import { getSummary } from '@/features/memorisation/server';
import { getDefaultEdition } from '@/features/quran/server';

export const metadata: Metadata = {
  title: 'Goals',
  description: 'Targets, required pace and honest projections.',
};

export default async function GoalsPage() {
  await requireUser();

  const [edition, goals, summary] = await Promise.all([
    getDefaultEdition(),
    getGoals(),
    getSummary(),
  ]);

  if (!edition) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No mushaf edition is configured</AlertTitle>
        <AlertDescription>
          <p>Seed the Quran reference data before setting goals.</p>
        </AlertDescription>
      </Alert>
    );
  }

  const active = goals.filter(
    (goal) => goal.status === 'active' && goal.state !== 'complete'
  );
  const finished = goals.filter(
    (goal) => goal.status !== 'active' || goal.state === 'complete'
  );

  const hasMemorisation = (summary?.memorised_ayahs ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Goals
          </h1>
          <p className="text-sm text-muted-foreground">
            Pace is measured against what you have actually recorded, not
            against the plan.
          </p>
        </div>
        {goals.length > 0 ? <CreateGoalDialog editionId={edition.id} /> : null}
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No goals yet</CardTitle>
            <CardDescription>
              A goal is a scope and a date. Everything else is derived.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Whatever you have already memorised inside a goal&apos;s scope
                counts toward it immediately, and the required pace is worked
                out over what genuinely remains.
              </p>
              <p>
                Projections come from your recorded pace over the last
                fortnight. If that pace does not reach the date, the goal will
                say so plainly rather than showing a reassuring bar.
              </p>
            </div>
            {hasMemorisation ? (
              <CreateGoalDialog
                editionId={edition.id}
                triggerLabel="Create your first goal"
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="outline">
                  <Link href="/memorisation">Record memorisation first</Link>
                </Button>
                <span className="text-xs text-muted-foreground">
                  Goals are more useful once there is a baseline to measure
                  from.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {active.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Active
          </h2>
          <div className="space-y-4">
            {active.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </section>
      ) : null}

      {finished.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Finished
          </h2>
          <p className="-mt-2 text-xs text-muted-foreground">
            Abandoned goals are kept. A target that turned out to be unrealistic
            is worth remembering when setting the next one.
          </p>
          <div className="space-y-4">
            {finished.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </section>
      ) : null}

      {goals.length > 0 && active.length === 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Target
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                No active goals. Setting one gives the daily numbers something
                to point at.
              </p>
            </div>
            <CreateGoalDialog editionId={edition.id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
