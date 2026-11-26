import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { requireUser } from '@/features/auth/server';
import { initialsFrom, UserMenu } from '@/features/profile';
import { OfflineBanner } from '@/features/offline';
import { getProfile } from '@/features/profile/server';
import { NavLinks } from './nav-links';
import { PageTransition } from './page-transition';

/**
 * Application shell.
 *
 * Middleware already blocks unauthenticated requests to these routes, but
 * `requireUser()` runs here too. Authorisation is enforced where data is read,
 * not only at the edge, so a route added outside the middleware matcher cannot
 * silently become public.
 *
 * A header rather than a sidebar rail: at this size a rail would be mostly
 * empty space, and the tracking grid benefits from the full width.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, profile, t] = await Promise.all([
    requireUser(),
    getProfile(),
    getTranslations('nav'),
  ]);

  const links = [
    { href: '/dashboard', label: t('dashboard') },
    { href: '/memorisation', label: t('memorisation') },
    { href: '/murajaah', label: t('murajaah') },
    { href: '/goals', label: t('goals') },
    { href: '/analytics', label: t('analytics') },
  ];

  return (
    <div className="flex min-h-svh flex-col">
      {/* The roof: a teal band with a folded-plate eave along its edge. The
          `dark` class keeps the controls inside it on light-on-teal colours
          in both themes. */}
      <header className="sticky top-0 z-40">
        <div className="dark bg-roof text-foreground">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-6">
              <Link href="/dashboard">
                <Logo />
              </Link>
              <NavLinks
                links={links}
                className="hidden items-center gap-1 md:flex"
                linkClassName="rounded-sm px-2.5 py-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <UserMenu
                displayName={profile?.display_name ?? null}
                email={user.email ?? ''}
                avatarUrl={profile?.avatar_url ?? null}
                initials={initialsFrom(
                  profile?.display_name ?? null,
                  user.email
                )}
              />
            </div>
          </div>

          {/* Below the breakpoint the header has no room for six links, so
              navigation moves to a scrollable strip rather than a hamburger:
              one tap instead of two, and the destinations stay visible. */}
          {/* All five destinations fit at phone width in both languages (about
              43 characters either way) at 12px; the strip only scrolls on
              screens narrower than that. */}
          <div className="md:hidden">
            <NavLinks
              links={links}
              className="mx-auto flex w-full max-w-6xl justify-between overflow-x-auto px-3 pb-2"
              linkClassName="shrink-0 rounded-sm px-1.5 py-1.5 text-xs whitespace-nowrap"
            />
          </div>
        </div>
        <div aria-hidden="true" className="eave bg-roof" />
      </header>

      <OfflineBanner />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
