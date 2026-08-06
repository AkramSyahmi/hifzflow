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
import {
  ActivityHeatmap,
  GrowthChart,
  PageStrengthList,
  ReviewTrendChart,
  StatGrid,
  type Stat,
} from '@/features/analytics';
import {
  getActivityCalendar,
  getActivitySummary,
  getMemorisationGrowth,
  getMostReviewedPages,
  getReviewTotals,
  getReviewTrend,
  getStrongestPages,
  getWeakestPages,
} from '@/features/analytics/server';
import { requireUser } from '@/features/auth/server';
import { getPageStatus, getSummary } from '@/features/memorisation/server';
import { getStreak, localDateForRequest } from '@/features/murajaah/server';
import { getProfile } from '@/features/profile/server';
import { getDefaultEdition } from '@/features/quran/server';
import { MADANI_PAGE_COUNT, TOTAL_JUZ, TOTAL_SURAHS } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Trends, strengths and weaknesses across your memorisation.',
};

function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export default async function AnalyticsPage() {
  await requireUser();

  const [profile, edition, summary] = await Promise.all([
    getProfile(),
    getDefaultEdition(),
    getSummary(),
  ]);

  if (!edition) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No mushaf edition is configured</AlertTitle>
        <AlertDescription>
          <p>Seed the Quran reference data first.</p>
        </AlertDescription>
      </Alert>
    );
  }

  const today = localDateForRequest(profile?.timezone ?? 'UTC');
  const hasMemorisation = (summary?.memorised_ayahs ?? 0) > 0;

  if (!hasMemorisation) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Trends across your memorisation and review.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Nothing to analyse yet</CardTitle>
            <CardDescription>
              These figures come from your own records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Record some memorisation and work through a few days of murajaah.
              Strengths and weaknesses need review history to mean anything.
            </p>
            <Button asChild>
              <Link href="/memorisation">Record memorisation</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [
    pages,
    activity,
    activitySummary,
    streak,
    reviewTotals,
    trend,
    growth,
    strongest,
    weakest,
    mostReviewed,
  ] = await Promise.all([
    getPageStatus(edition.id),
    getActivityCalendar(shiftDays(today, -364), today),
    getActivitySummary(),
    getStreak(),
    getReviewTotals(),
    getReviewTrend(shiftDays(today, -83), today),
    getMemorisationGrowth(shiftDays(today, -179), today),
    getStrongestPages(),
    getWeakestPages(),
    getMostReviewedPages(),
  ]);

  const completePages = pages.filter(
    (page) => page.ayah_count > 0 && page.memorised_ayahs >= page.ayah_count
  ).length;

  const juzComplete = Array.from(
    { length: TOTAL_JUZ },
    (_, index) => index + 1
  ).filter((juz) => {
    const group = pages.filter((page) => page.juz === juz);
    return (
      group.length > 0 &&
      group.every((page) => page.memorised_ayahs >= page.ayah_count)
    );
  }).length;

  const stats: Stat[] = [
    {
      label: 'Memorised',
      value: `${summary?.percent_of_quran ?? 0}%`,
      detail: `${(summary?.memorised_ayahs ?? 0).toLocaleString('en')} ayahs`,
    },
    {
      label: 'Pages complete',
      value: completePages.toLocaleString('en'),
      detail: `of ${MADANI_PAGE_COUNT}`,
    },
    {
      label: "Juz' complete",
      value: String(juzComplete),
      detail: `of ${TOTAL_JUZ}`,
    },
    {
      label: 'Surahs touched',
      value: String(summary?.surahs_touched ?? 0),
      detail: `of ${TOTAL_SURAHS}`,
    },
    {
      label: 'Longest streak',
      value: String(streak?.longest_streak ?? 0),
      detail: `current ${streak?.current_streak ?? 0}`,
    },
    {
      label: 'Reviews logged',
      value: (reviewTotals?.total_reviews ?? 0).toLocaleString('en'),
      detail:
        reviewTotals?.average_confidence != null
          ? `mean ${reviewTotals.average_confidence}`
          : 'no ratings yet',
    },
  ];

  const hasReviews = (reviewTotals?.total_reviews ?? 0) > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything here comes from what you have recorded. Nothing is
          extrapolated.
        </p>
      </div>

      <StatGrid stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle>Memorisation over time</CardTitle>
          <CardDescription>
            Cumulative ayahs across the last six months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GrowthChart data={growth} />
          <p className="mt-2 text-xs text-muted-foreground">
            Flat stretches are shown rather than smoothed away — they are as
            informative as the climbs.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review volume and confidence</CardTitle>
          <CardDescription>
            Weekly pages reviewed by tier, with mean rating
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasReviews ? (
            <>
              <ReviewTrendChart data={trend} />
              <p className="mt-2 text-xs text-muted-foreground">
                Volume rising while confidence falls usually means the daily
                budget is set too high. Neither line shows that alone.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No reviews logged yet. Work through a few days of murajaah and
              this fills in.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Strongest</CardTitle>
            <CardDescription>
              Highest strength, three or more reviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PageStrengthList
              pages={strongest}
              metric="strength"
              emptyMessage="No page has been reviewed three times yet. Below that there is not enough evidence to call anything strong."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weakest</CardTitle>
            <CardDescription>
              Lowest strength, three or more reviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PageStrengthList
              pages={weakest}
              metric="strength"
              emptyMessage="Nothing ranked yet. Pages need three reviews before they appear here."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most reviewed</CardTitle>
            <CardDescription>Where the time has gone</CardDescription>
          </CardHeader>
          <CardContent>
            <PageStrengthList
              pages={mostReviewed}
              metric="reviews"
              emptyMessage="No reviews logged yet."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consistency</CardTitle>
          <CardDescription>
            Active on {activitySummary?.days_active_30 ?? 0} of the last 30
            days, {activitySummary?.days_active_90 ?? 0} of the last 90
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ActivityHeatmap days={activity} />
          <p className="text-xs text-muted-foreground">
            Consistency is reported as days active rather than as a streak. A
            streak rewards never missing; this describes what actually happened.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How strength is calculated</CardTitle>
          <CardDescription>So the rankings can be argued with</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm text-muted-foreground">
          <p>
            Strength blends the mean of every rating with the most recent one,
            two parts recent to one part history. A page rated two last week is
            weak now regardless of how it went a year ago.
          </p>
          <p>
            Pages with fewer than three reviews are excluded from the strongest
            and weakest lists. One review rated five is not strength, it is a
            single impression — ranking it would make the list a record of luck
            rather than of recall.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
