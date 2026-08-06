import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

/**
 * Served by the service worker when a navigation fails and no cached copy of
 * the requested page exists.
 *
 * Deliberately static and dependency-free: it has to render with no network, no
 * session and no database, which rules out anything that reads user data.
 */
export default async function OfflinePage() {
  const t = await getTranslations('offline');

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div className="max-w-sm space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('body')}
        </p>
      </div>
      <Button asChild>
        <a href="/dashboard">{t('backOnline')}</a>
      </Button>
    </main>
  );
}
