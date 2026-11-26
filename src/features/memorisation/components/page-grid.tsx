'use client';

import { Loader2 } from 'lucide-react';
import { useOutbox } from '@/features/offline';
import { useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TOTAL_JUZ } from '@/lib/constants';
import { cn } from '@/lib/utils';

import { togglePageAction } from '../actions/memorisation-actions';
import { densityClass, densityLabel, densityLevel } from '../lib/density';
import type { PageStatus } from '../queries/get-page-status';

/**
 * The tracking grid: 604 pages, grouped by juz', click to toggle.
 *
 * Pages are the primary unit because that is how most people record progress —
 * "I did page 47 today". Surah entry and explicit ayah ranges live in the
 * record form for the cases pages do not fit.
 *
 * Toggling is optimistic. The round trip is fast but not instant, and a grid
 * that lags behind the cursor feels broken when you are marking a dozen pages
 * in a row.
 */
export function PageGrid({
  pages,
  editionId,
}: {
  pages: readonly PageStatus[];
  editionId: number;
}) {
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set());
  const { online, queue } = useOutbox();

  const [optimisticPages, applyOptimistic] = useOptimistic(
    pages,
    (state, change: { page: number; memorised: boolean }) =>
      state.map((entry) =>
        entry.page_number === change.page
          ? {
              ...entry,
              memorised_ayahs: change.memorised ? entry.ayah_count : 0,
            }
          : entry
      )
  );

  function toggle(page: PageStatus) {
    const nowMemorised = page.memorised_ayahs < page.ayah_count;

    startTransition(async () => {
      applyOptimistic({ page: page.page_number, memorised: nowMemorised });
      setPending((current) => new Set(current).add(page.page_number));

      const payload = {
        editionId,
        page: page.page_number,
        memorised: nowMemorised,
      };

      /*
       * Offline writes go to the outbox rather than being attempted and lost.
       * The optimistic value stays on screen because the change is real from
       * the user's point of view — it is recorded, just not yet sent.
       */
      if (!online) {
        await queue('toggle-page', payload);
        setPending((current) => {
          const next = new Set(current);
          next.delete(page.page_number);
          return next;
        });
        return;
      }

      const result = await togglePageAction(payload);

      setPending((current) => {
        const next = new Set(current);
        next.delete(page.page_number);
        return next;
      });

      if (!result.success) {
        // A failure that is not the network: queue it rather than discard it,
        // since `navigator.onLine` lies often enough that this is the common
        // case on a flaky connection.
        await queue('toggle-page', payload);
        toast.error(result.error);
      }
    });
  }

  const byJuz = Array.from({ length: TOTAL_JUZ }, (_, index) => ({
    juz: index + 1,
    pages: optimisticPages.filter((page) => page.juz === index + 1),
  })).filter((group) => group.pages.length > 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5">
        {byJuz.map((group) => {
          const memorised = group.pages.reduce(
            (sum, page) => sum + page.memorised_ayahs,
            0
          );
          const total = group.pages.reduce(
            (sum, page) => sum + page.ayah_count,
            0
          );

          return (
            <section key={group.juz} className="space-y-2">
              <header className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-sm font-semibold tracking-tight">
                  Juz&apos; {group.juz}
                </h3>
                <span className="tabular text-xs text-muted-foreground">
                  {Math.round((memorised / total) * 100)}% · pages{' '}
                  {group.pages[0]?.page_number}–
                  {group.pages[group.pages.length - 1]?.page_number}
                </span>
              </header>

              <div className="flex flex-wrap gap-0.5">
                {group.pages.map((page) => {
                  const level = densityLevel(
                    page.memorised_ayahs,
                    page.ayah_count
                  );
                  const isPending = pending.has(page.page_number);
                  const isComplete = page.memorised_ayahs >= page.ayah_count;

                  return (
                    <Tooltip key={page.page_number}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => toggle(page)}
                          disabled={isPending}
                          aria-pressed={isComplete}
                          aria-label={`Page ${page.page_number}, ${densityLabel(
                            page.memorised_ayahs,
                            page.ayah_count
                          )}`}
                          className={cn(
                            // A breeze block: concrete frame, the page's
                            // memorisation showing through the opening.
                            'relative flex size-9 items-center justify-center rounded-[2px] bg-block text-[11px] font-semibold transition-all sm:size-8',
                            'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            'hover:ring-2 hover:ring-foreground/30',
                            level >= 3
                              ? 'text-primary-foreground'
                              : 'text-foreground/75',
                            isPending && 'opacity-60'
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'breeze-opening absolute inset-0 transition-colors',
                              densityClass(level)
                            )}
                          />
                          {isPending ? (
                            <Loader2 className="relative size-3 animate-spin" />
                          ) : (
                            <span className="tabular relative">
                              {page.page_number}
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Page {page.page_number} ·{' '}
                        {densityLabel(page.memorised_ayahs, page.ayah_count)}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
