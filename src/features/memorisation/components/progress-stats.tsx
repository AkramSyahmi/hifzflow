import { MADANI_PAGE_COUNT, TOTAL_AYAHS, TOTAL_JUZ } from '@/lib/constants';
import { cn } from '@/lib/utils';

import type { PageStatus } from '../queries/get-page-status';

function Stat({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <div className={cn('bg-card px-5 py-4', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="tabular mt-1.5 font-display text-3xl leading-none font-bold tracking-tight">
        {value}
      </p>
      <p className="tabular mt-1.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

/**
 * Headline figures, derived from the same page data the grid renders so the
 * two can never disagree.
 */
export function ProgressStats({ pages }: { pages: readonly PageStatus[] }) {
  const memorisedAyahs = pages.reduce(
    (sum, page) => sum + page.memorised_ayahs,
    0
  );
  const completePages = pages.filter(
    (page) => page.ayah_count > 0 && page.memorised_ayahs >= page.ayah_count
  ).length;
  const startedPages = pages.filter((page) => page.memorised_ayahs > 0).length;

  const juzComplete = new Set(
    Array.from({ length: TOTAL_JUZ }, (_, index) => index + 1).filter((juz) => {
      const group = pages.filter((page) => page.juz === juz);
      if (group.length === 0) return false;
      return group.every((page) => page.memorised_ayahs >= page.ayah_count);
    })
  ).size;

  const percent = ((memorisedAyahs / TOTAL_AYAHS) * 100).toFixed(1);

  return (
    // One slab ruled into cells (1px gaps over the border colour), not four
    // separate cards.
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-4">
      <Stat
        label="Of the Quran"
        value={`${percent}%`}
        detail={`${memorisedAyahs.toLocaleString('en')} of ${TOTAL_AYAHS.toLocaleString('en')} ayahs`}
      />
      <Stat
        label="Pages complete"
        value={completePages.toLocaleString('en')}
        detail={`of ${MADANI_PAGE_COUNT} · ${startedPages - completePages} in progress`}
      />
      <Stat
        label="Juz' complete"
        value={String(juzComplete)}
        detail={`of ${TOTAL_JUZ}`}
      />
      <Stat
        label="Remaining"
        value={(MADANI_PAGE_COUNT - completePages).toLocaleString('en')}
        detail="pages to go"
      />
    </div>
  );
}
