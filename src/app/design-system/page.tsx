import type { Metadata } from 'next';
import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Design system',
  description:
    'Colour, type and component reference for HifzFlow. Every screen is built from these tokens.',
};

const surfaces = [
  { name: 'background', className: 'bg-background' },
  { name: 'card', className: 'bg-card' },
  { name: 'muted', className: 'bg-muted' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'primary', className: 'bg-primary' },
  { name: 'destructive', className: 'bg-destructive' },
];

const states = [
  { name: 'new', label: 'Not started', className: 'bg-state-new' },
  { name: 'learning', label: 'Learning', className: 'bg-state-learning' },
  { name: 'memorised', label: 'Memorised', className: 'bg-state-memorised' },
  { name: 'weak', label: 'Weak', className: 'bg-state-weak' },
  { name: 'overdue', label: 'Overdue', className: 'bg-state-overdue' },
];

const ramp = [
  { name: 'hifz-0', className: 'bg-hifz-0' },
  { name: 'hifz-1', className: 'bg-hifz-1' },
  { name: 'hifz-2', className: 'bg-hifz-2' },
  { name: 'hifz-3', className: 'bg-hifz-3' },
  { name: 'hifz-4', className: 'bg-hifz-4' },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b py-12">
      <div className="mb-6 space-y-1">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">
        <div className="py-12">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Design system
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Every colour below is a CSS custom property with a light and dark
            value. Components reference the token, never a raw colour, so
            switching themes is a class change on <code>html</code> and nothing
            else.
          </p>
        </div>

        <Section
          title="Surfaces"
          description="Structural colours. Kept near-neutral so that progress data is the only saturated thing on screen."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {surfaces.map((surface) => (
              <div key={surface.name} className="space-y-2">
                <div
                  className={`h-16 rounded-lg border ${surface.className}`}
                />
                <p className="font-mono text-xs text-muted-foreground">
                  {surface.name}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Memorisation states"
          description="The five states a passage can be in. Defined once so the tracking grid, review queue and analytics never invent their own status colour."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {states.map((state) => (
              <div key={state.name} className="space-y-2">
                <div className={`h-16 rounded-lg border ${state.className}`} />
                <div>
                  <p className="text-sm font-medium">{state.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    state-{state.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Density ramp"
          description="Five steps from untouched to fully committed. Drives the activity heatmap and the whole-mushaf density strip."
        >
          <div className="flex flex-wrap gap-2">
            {ramp.map((step) => (
              <div key={step.name} className="space-y-2">
                <div
                  className={`size-14 rounded-md border ${step.className}`}
                />
                <p className="font-mono text-xs text-muted-foreground">
                  {step.name}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Typography"
          description="Instrument Sans sets headings, Inter carries the interface, and Noto Naskh Arabic renders surah names. Numerals are tabular everywhere so counters do not shift as they increment."
        >
          <div className="space-y-6">
            <div>
              <p className="font-display text-3xl font-semibold tracking-tight">
                Display · Instrument Sans
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                font-display
              </p>
            </div>
            <div>
              <p className="text-base">
                Interface · Inter. Used for body copy, labels, form fields and
                every piece of running text in the product.
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                font-sans
              </p>
            </div>
            <div>
              <p lang="ar" className="text-2xl">
                سُورَةُ الْفَاتِحَة
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                font-arabic · right-to-left, loose leading
              </p>
            </div>
            <div>
              <p className="tabular text-2xl font-medium">
                604 · 6,236 · 30 · 114
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                tabular figures
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="Buttons"
          description="Six variants, four sizes. Focus rings are visible on every one of them."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button>Save progress</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete record</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section
          title="Cards"
          description="The container every dashboard panel is built from."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s murajaah</CardTitle>
                <CardDescription>
                  What the scheduler has queued for review
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="tabular text-3xl font-semibold">12</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  pages across Juz&apos; 28 and 29
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Current streak</CardTitle>
                <CardDescription>
                  Consecutive days with a completed session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="tabular text-3xl font-semibold">41</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  days · longest is 63
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Figures above are illustrative, to show the components at realistic
            density. Nothing on this page reads from the database.
          </p>
        </Section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-6 text-xs text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">
            Back to home
          </Link>
        </div>
      </footer>
    </div>
  );
}
