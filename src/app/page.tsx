import Link from 'next/link';

import { HifzScreen } from '@/components/brand/hifz-screen';
import { SCREEN_OPENING } from '@/components/brand/screen-states';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';

const tiers = [
  {
    term: 'Manzil',
    state: 'manzil',
    today: false,
    body: 'The rotation through everything you hold, continuing in page order each day so a day’s review can be recited in sequence.',
  },
  {
    term: 'Sabqi',
    state: 'sabqi',
    today: false,
    body: 'Pages memorised in the last 30 days get their own slice of the day, because recent material fades faster than the rotation can catch.',
  },
  {
    term: 'Weak pages',
    state: 'weak',
    today: false,
    body: 'Pages you rate 2 or below are pulled forward, but never take more than a third of the day, so the rotation keeps moving.',
  },
  {
    term: 'Today',
    state: 'manzil',
    today: true,
    body: 'The pages framed in white. You rate each one from 1 to 5 as you finish it, and tomorrow is planned from those ratings.',
  },
] as const;

/* Left edge of the 72rem content column, so full-bleed sections can still
   line their text up with the header. */
const COLUMN_START = 'lg:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-svh flex-col">
      <header>
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {params.deleted ? (
          <div className="mx-auto max-w-6xl px-6 pb-6">
            <p className="text-sm text-muted-foreground">
              Your account and all of its records have been deleted. Nothing was
              retained.
            </p>
          </div>
        ) : null}

        <section className="grid lg:min-h-[calc(100svh-4rem)] lg:grid-cols-12">
          <div
            className={`flex flex-col justify-center px-6 pt-10 pb-14 lg:col-span-5 lg:py-16 lg:pr-12 ${COLUMN_START}`}
          >
            <h1 className="font-display text-4xl leading-[1.06] font-bold tracking-tight text-balance sm:text-5xl">
              Memorise the Quran on a schedule you can actually keep.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              {APP_NAME} plans your hifz and schedules murajaah the way huffaz
              actually recite.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button asChild size="lg">
                <Link href="/sign-up">Create an account</Link>
              </Button>
              <Link
                href="/sign-in"
                className="text-sm font-medium underline underline-offset-4 hover:text-primary"
              >
                I already have an account
              </Link>
            </div>
          </div>

          {/* The roof field, the one roof line on this page. `dark` gives
              the screen light-on-teal text in both themes. */}
          <div className="dark flex flex-col lg:col-span-7">
            <div aria-hidden="true" className="ridge bg-roof" />
            <div className="flex flex-1 items-center justify-center bg-roof px-6 py-10 text-foreground sm:px-10 lg:px-14">
              <HifzScreen className="w-full max-w-[26rem]" />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 sm:py-28 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              Built for keeping what you have memorised, not just for reading.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Every day&apos;s review is built from the pages you already hold.
              This is how to read the screen above.
            </p>
          </div>

          <dl className="divide-y border-y lg:col-span-7">
            {tiers.map((tier) => (
              <div key={tier.term} className="flex gap-5 py-5">
                <span
                  aria-hidden="true"
                  className="dark mt-0.5 size-9 shrink-0 bg-roof p-1.5"
                >
                  <span
                    className={`relative block size-full ${tier.today ? 'bg-white' : 'bg-white/18'}`}
                  >
                    <span
                      className={`breeze-opening absolute inset-0 ${SCREEN_OPENING[tier.state]}`}
                    />
                  </span>
                </span>
                <div>
                  <dt className="font-display text-base font-semibold tracking-tight">
                    {tier.term}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {tier.body}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <section className="dark bg-roof text-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Start with what you already know.
              </h2>
              <p className="mt-2 max-w-lg text-sm text-foreground/80">
                Mark the pages you have memorised. Today&apos;s murajaah builds
                itself from them.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="bg-sun text-[oklch(0.22_0.04_70)] hover:bg-sun/90"
            >
              <Link href="/sign-up">Create an account</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="dark bg-roof text-foreground/75">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-foreground/15 px-6 py-4 text-xs">
          <span>{APP_NAME} — Quran memorisation and murajaah planner.</span>
          <span className="flex items-center gap-4">
            <Link
              href="/design-system"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Design system
            </Link>
            <span className="tabular">v0.1.0</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
