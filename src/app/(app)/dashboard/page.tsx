import { ArrowRight, CheckCircle2, Flame, MoonStar } from 'lucide-react';
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
import { ActivityHeatmap } from '@/features/analytics';
import {
  getActivityCalendar,
  getActivitySummary,
} from '@/features/analytics/server';
import { requireUser } from '@/features/auth/server';
import { GoalCard } from '@/features/goals';
import { getPrimaryGoal } from '@/features/goals/server';
import {
  DensityLegend,
  MushafStrip,
  ProgressStats,
} from '@/features/memorisation';
import { getPageStatus } from '@/features/memorisation/server';
import { isRestDay, PlanForm, ReviewQueue } from '@/features/murajaah';
import {
  getPlan,
  getStreak,
  getTodayQueue,
  localDateForRequest,
} from '@/features/murajaah/server';
import { getProfile } from '@/features/profile/server';
import { getDefaultEdition } from '@/features/quran/server';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/** The date a year ago today, as YYYY-MM-DD, for the heatmap window. */
function yearAgo(today: string): string {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Dashboard.
 *
 * Ordered by what the person needs to decide: today's review first, because
 * that is the action; then where they stand; then the longer view. Anything
 * that does not help answer "what should I do now" belongs on another page.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; password?: string }>;
}) {
  const [user, profile, params, edition] = await Promise.all([
    requireUser(),
    getProfile(),
    searchParams,
    getDefaultEdition(),
  ]);

  const today = localDateForRequest(profile?.timezone ?? 'UTC');
  const firstName = profile?.display_name?.trim().split(/\s+/)[0];

  const localDate = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: profile?.timezone ?? 'UTC',
  }).format(new Date());

  if (!edition) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Assalamualaikum{firstName ? `, ${firstName}` : ''}
        </h1>
        <Alert variant="destructive">
          <AlertTitle>Reference data not seeded</AlertTitle>
          <AlertDescription>
            <p>
              Apply the migrations and{' '}
              <code>supabase/seed/quran_reference.sql</code>, then reload.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [pages, plan, activity, activitySummary, streak, goal] =
    await Promise.all([
      getPageStatus(edition.id),
      getPlan(),
      getActivityCalendar(yearAgo(today), today),
      getActivitySummary(),
      getStreak(),
      getPrimaryGoal(),
    ]);

  const hasProgress = pages.some((page) => page.memorised_ayahs > 0);
  const queue = plan ? await getTodayQueue(today) : [];
  const remaining = queue.filter((item) => item.completed_at === null).length;
  const restDay = plan !== null && isRestDay(today, plan.rest_days);

  const consistency = activitySummary
    ? Math.round((activitySummary.days_active_30 / 30) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {params.welcome ? (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>Email confirmed</AlertTitle>
          <AlertDescription>
            <p>Your account is ready.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {params.password ? (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>Password updated</AlertTitle>
          <AlertDescription>
            <p>Use your new password next time you sign in.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Assalamualaikum{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">{localDate}</p>
        </div>
        {streak && streak.current_streak > 0 ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Flame className="size-4 text-state-weak" aria-hidden="true" />
            <span className="tabular">{streak.current_streak}</span> day streak
            <span className="text-muted-foreground/60">
              · best {streak.longest_streak}
            </span>
          </span>
        ) : null}
      </header>

      {/* Today first: it is the only part of this page that is an action. */}
      {!hasProgress ? (
        <Card>
          <CardHeader>
            <CardTitle>Start here</CardTitle>
            <CardDescription>
              Record what you already know, and the rest follows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              HifzFlow schedules review around what is already in memory. Mark a
              few pages you know well and today&apos;s murajaah builds itself.
            </p>
            <Button asChild>
              <Link href="/memorisation">
                Record memorisation
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : !plan ? (
        <Card>
          <CardHeader>
            <CardTitle>Set up your rotation</CardTitle>
            <CardDescription>
              You have memorisation recorded but no review plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Two questions — how much a day, and how recent material is
              handled. Everything else the scheduler works out.
            </p>
            <PlanForm
              plan={null}
              editionId={edition.id}
              triggerLabel="Create my plan"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Today&apos;s murajaah</CardTitle>
              <CardDescription>
                {queue.length === 0
                  ? restDay
                    ? 'A scheduled rest day'
                    : 'Nothing scheduled'
                  : `${queue.length - remaining} of ${queue.length} done`}
              </CardDescription>
            </div>
            {queue.length > 0 ? (
              <Badge variant={remaining === 0 ? 'memorised' : 'secondary'}>
                {remaining === 0 ? 'Complete' : `${remaining} left`}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {queue.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                {restDay ? (
                  <>
                    <MoonStar className="size-4" aria-hidden="true" />
                    No review today. The rotation picks up tomorrow.
                  </>
                ) : (
                  'Nothing is scheduled — no page is fully memorised yet.'
                )}
              </p>
            ) : (
              <>
                <ReviewQueue items={queue.slice(0, 5)} />
                <Button asChild variant="outline" size="sm">
                  <Link href="/murajaah">
                    {queue.length > 5
                      ? `See all ${queue.length}`
                      : 'Open murajaah'}
                    <ArrowRight />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {goal ? <GoalCard goal={goal} compact /> : null}

      {hasProgress ? (
        <>
          <ProgressStats pages={pages} />

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Activity</CardTitle>
                <CardDescription>The last year, day by day</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 space-y-4">
                <ActivityHeatmap days={activity} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Active on{' '}
                    <span className="tabular font-medium text-foreground">
                      {activitySummary?.days_active_30 ?? 0}
                    </span>{' '}
                    of the last 30 days
                    <span className="text-muted-foreground/70">
                      {' '}
                      · {consistency}% consistency
                    </span>
                  </p>
                  <DensityLegend />
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Across the mushaf</CardTitle>
                <CardDescription>Not just how much, but where</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MushafStrip pages={pages} />
                <Button asChild variant="outline" size="sm">
                  <Link href="/memorisation">
                    Record progress
                    <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Signed in as {user.email} · times shown in {profile?.timezone ?? 'UTC'}
      </p>
    </div>
  );
}
