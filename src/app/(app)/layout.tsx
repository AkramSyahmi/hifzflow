import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { requireUser } from '@/features/auth/server';
import { initialsFrom, UserMenu } from '@/features/profile';
import { OfflineBanner } from '@/features/offline';
import { getProfile } from '@/features/profile/server';

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
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu
              displayName={profile?.display_name ?? null}
              email={user.email ?? ''}
              avatarUrl={profile?.avatar_url ?? null}
              initials={initialsFrom(profile?.display_name ?? null, user.email)}
            />
          </div>
        </div>
      </header>

      <OfflineBanner />

      {/* Below the breakpoint the header has no room for six links, so
          navigation moves to a scrollable strip rather than a hamburger: one
          tap instead of two, and the destinations stay visible. */}
      <div className="border-b md:hidden">
        <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 py-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-md px-2.5 py-1 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
