'use client';

import { CloudOff, RefreshCw, UploadCloud } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { useOutbox } from '../hooks/use-outbox';

/**
 * Connection and queue status.
 *
 * Shown only when there is something to say. A permanent "you are online"
 * indicator is noise, and noise is what stops people reading the bar on the day
 * it matters.
 */
export function OfflineBanner() {
  const t = useTranslations('offline');
  const { online, queued, flushing, flush } = useOutbox();

  if (online && queued === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'border-b px-6 py-2 text-sm',
        online
          ? 'border-state-learning/25 bg-state-learning/10'
          : 'border-state-weak/25 bg-state-weak/10'
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1">
        {online ? (
          <UploadCloud className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <CloudOff className="size-4 shrink-0" aria-hidden="true" />
        )}

        <span>
          {!online
            ? queued > 0
              ? t('offlineWithQueue', { count: queued })
              : t('offline')
            : flushing
              ? t('syncing')
              : t('queued', { count: queued })}
        </span>

        {online && queued > 0 && !flushing ? (
          <button
            type="button"
            onClick={() => void flush()}
            className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            {t('retry')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
