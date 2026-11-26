import { CalendarCheck, Flame, MoonStar } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireUser } from '@/features/auth/server';
import { getSummary } from '@/features/memorisation/server';
import {
  isRestDay,
  PlanForm,
  ReviewQueue,
  WeakPages,
} from '@/features/murajaah';
import {
  getOverdue,
  getPlan,
  getStreak,
  getTodayQueue,
  getWeakPages,
  localDateForRequest,
} from '@/features/murajaah/server';
import { getProfile } from '@/features/profile/server';
import { getDefaultEdition } from '@/features/quran/server';

export const metadata: Metadata = {
  title: 'Murajaah',
  description: "Today's review, weak passages and your rotation.",
};

export default async function MurajaahPage() {
  await requireUser();

  const [profile, edition, plan] = await Promise.all([
    getProfile(),
    getDefaultEdition(),
    getPlan(),
  ]);

  if (!edition) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No mushaf edition is configured</AlertTitle>
        <AlertDescription>
          <p>Seed the Quran reference data before setting up a review plan.</p>
        </AlertDescription>
      </Alert>
    );
  }

  // The queue is keyed to the user's own calendar date. Using the server's
  // date would hand someone in Kuala Lumpur tomorrow's queue at 8am.
  const today = localDateForRequest(profile?.timezone ?? 'UTC');

  const summary = await getSummary();
  const hasMemorisation = (summary?.memorised_ayahs ?? 0) > 0;

  if (!hasMemorisation) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Murajaah
          </h1>
          <p className="text-sm text-muted-foreground">Your review rotation.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Nothing to review yet</CardTitle>
            <CardDescription>
              Murajaah schedules what you have already memorised
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Record a page or two first. Once there is something in memory, the
              rotation builds itself around it.
            </p>
            <Button asChild>
              <Link href="/memorisation">Record memorisation</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Murajaah
          </h1>
          <p className="text-sm text-muted-foreground">
            Set a plan and the daily rotation builds itself.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Set up your rotation</CardTitle>
            <CardDescription>
              Two questions: how much a day, and how recent material is handled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Review is organised the way most tahfiz programmes already work.{' '}
                <span className="font-medium text-foreground">Sabqi</span> is
                recent memorisation still being consolidated;{' '}
                <span className="font-medium text-foreground">manzil</span> is
                everything older, cycled continuously.
              </p>
              <p>
                The manzil rotation moves through your pages in order, so each
                day&apos;s review can actually be recited in sequence rather
                than jumping around the mushaf. Pages you rate poorly get pulled
                forward on top of it.
              </p>
            </div>
            <PlanForm
              plan={null}
              editionId={edition.id}
              triggerLabel="Create my plan"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const [queue, overdue, weak, streak] = await Promise.all([
    getTodayQueue(today),
    getOverdue(today),
    getWeakPages(),
    getStreak(),
  ]);

  const restDay = isRestDay(today, plan.rest_days);
  const remaining = queue.filter((item) => item.completed_at === null).length;
  const done = queue.length - remaining;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Murajaah
          </h1>
          <p className="text-sm text-muted-foreground">
            {plan.mode === 'daily_quantity'
              ? `${plan.daily_pages} pages a day`
              : `Full cycle every ${plan.cycle_days} days`}{' '}
            · rotation at page {plan.manzil_cursor}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {streak && streak.current_streak > 0 ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Flame className="size-4 text-state-weak" aria-hidden="true" />
              <span className="tabular">{streak.current_streak}</span> day
              streak
            </span>
          ) : null}
          <PlanForm plan={plan} editionId={edition.id} />
        </div>
      </div>

      {overdue.length > 0 ? (
        <Alert>
          <CalendarCheck />
          <AlertTitle>
            {overdue.length} page{overdue.length === 1 ? '' : 's'} missed
            earlier
          </AlertTitle>
          <AlertDescription>
            <p>
              These stay on the record but do not block today. Work through
              today first, then catch up if you have time.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Today</CardTitle>
            <CardDescription>
              {restDay
                ? 'A scheduled rest day'
                : queue.length === 0
                  ? 'Nothing scheduled'
                  : `${done} of ${queue.length} done`}
            </CardDescription>
          </div>
          {queue.length > 0 ? (
            <Badge variant={remaining === 0 ? 'memorised' : 'secondary'}>
              {remaining === 0 ? 'Complete' : `${remaining} left`}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {restDay ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MoonStar className="size-4" aria-hidden="true" />
              <span>
                No review scheduled today. The rotation picks up tomorrow.
              </span>
            </div>
          ) : queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing is scheduled. This usually means no page is fully
              memorised yet — partial pages are not scheduled, because reviewing
              half a page is a different exercise.
            </p>
          ) : (
            <ReviewQueue items={queue} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weak pages</CardTitle>
            <CardDescription>
              Rated {plan.weak_threshold} or below when last reviewed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeakPages pages={weak} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How this works</CardTitle>
            <CardDescription>The scheduling rules, in short</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Manzil</span> moves
              through your memorised pages in order, so a day&apos;s review can
              be recited in sequence.
            </p>
            <p>
              <span className="font-medium text-foreground">Sabqi</span> takes
              its own slice of the budget, because material from the last{' '}
              {plan.sabqi_window_days} days decays faster than the long rotation
              can catch.
            </p>
            <p>
              <span className="font-medium text-foreground">Weak pages</span>{' '}
              are pulled forward, but never take more than a third of the day.
              Without that cap a long list of weak pages would fill every day
              and the rotation would quietly stop advancing.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
