import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  APP_NAME,
  MADANI_PAGE_COUNT,
  TOTAL_AYAHS,
  TOTAL_JUZ,
} from '@/lib/constants';

const pillars = [
  {
    title: 'One source of truth',
    body: `Memorisation is stored as ayah ranges — all ${TOTAL_AYAHS.toLocaleString('en')} of them. Pages, surahs, juz' and hizb are views over that same record, so no two screens can ever disagree about what you know.`,
  },
  {
    title: 'Review that follows recitation',
    body: `Murajaah runs as a contiguous cycle, the way huffaz actually recite, with weak passages pulled forward on top of it. You get a flat daily load instead of ${MADANI_PAGE_COUNT} scattered pages.`,
  },
  {
    title: 'Progress you can defend',
    body: `Streaks, consistency, strongest and weakest passages, and completion per juz'. Numbers that tell you what to do tomorrow, not numbers that flatter you.`,
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Logo />
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/design-system">Design system</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">
        {params.deleted ? (
          <div className="border-b py-6">
            <p className="text-sm text-muted-foreground">
              Your account and all of its records have been deleted. Nothing was
              retained.
            </p>
          </div>
        ) : null}

        <section className="border-b py-20 sm:py-28">
          <p className="mb-4 text-xs font-medium tracking-widest text-primary uppercase">
            Milestone 9 · Settings
          </p>
          <h1 className="max-w-2xl font-display text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
            Memorise the Quran on a schedule you can actually keep.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            {APP_NAME} plans your hifz, schedules your murajaah around how
            recitation really works, and shows you exactly where your
            memorisation stands — across all {TOTAL_JUZ} juz&apos;.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Create an account</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/design-system">View the design system</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-px py-16 sm:grid-cols-3 sm:gap-8">
          {pillars.map((pillar) => (
            <div key={pillar.title} className="space-y-2">
              <h2 className="font-display text-sm font-semibold tracking-tight">
                {pillar.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {pillar.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6 text-xs text-muted-foreground">
          <span>
            {APP_NAME} — memorisation tracking arrives in the next milestones.
          </span>
          <span className="tabular">v0.1.0</span>
        </div>
      </footer>
    </div>
  );
}
