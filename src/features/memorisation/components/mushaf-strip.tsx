import { TOTAL_JUZ } from '@/lib/constants';
import { cn } from '@/lib/utils';

import { densityClass, densityLevel } from '../lib/density';
import type { PageStatus } from '../queries/get-page-status';

/**
 * The whole mushaf as a single strip.
 *
 * 604 pages rendered end to end, each shaded by how much of it is committed to
 * memory. At a glance it answers the question a progress percentage cannot:
 * not how much, but *where* — whether someone has worked steadily from the
 * back, scattered across juz, or stalled halfway.
 *
 * Deliberately not interactive. It is an overview; the grid below it is where
 * pages are actually recorded.
 */
export function MushafStrip({
  pages,
  className,
}: {
  pages: readonly PageStatus[];
  className?: string;
}) {
  const juzMarkers = Array.from({ length: TOTAL_JUZ }, (_, index) => {
    const juz = index + 1;
    const first = pages.find((page) => page.juz === juz);
    return { juz, page: first?.page_number ?? 1 };
  });

  const total = pages.length || 1;

  return (
    <figure className={cn('space-y-2', className)}>
      <div
        className="relative flex h-10 overflow-hidden rounded-md border border-border/60"
        role="img"
        aria-label={`Memorisation across all ${pages.length} pages of the mushaf`}
      >
        {pages.map((page) => (
          <div
            key={page.page_number}
            className={cn(
              'h-full flex-1',
              densityClass(densityLevel(page.memorised_ayahs, page.ayah_count))
            )}
          />
        ))}

        {/* Juz' boundaries, drawn over the bars so they read as a ruler. */}
        {juzMarkers.map((marker) =>
          marker.juz === 1 ? null : (
            <span
              key={marker.juz}
              aria-hidden="true"
              className="absolute inset-y-0 w-px bg-background/45"
              style={{ left: `${((marker.page - 1) / total) * 100}%` }}
            />
          )
        )}
      </div>

      <div className="relative h-3" aria-hidden="true">
        {juzMarkers
          .filter((marker) => marker.juz % 5 === 0 || marker.juz === 1)
          .map((marker) => (
            <span
              key={marker.juz}
              className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-muted-foreground"
              style={{
                left: `${Math.min(98, Math.max(2, ((marker.page - 1) / total) * 100))}%`,
              }}
            >
              {marker.juz}
            </span>
          ))}
      </div>

      <figcaption className="sr-only">
        Each vertical band is one page of the Madani mushaf, shaded by how much
        of it has been memorised. Tick labels mark juz boundaries.
      </figcaption>
    </figure>
  );
}

/** Key explaining the density ramp. Shared by the strip and the grid. */
export function DensityLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs text-muted-foreground',
        className
      )}
    >
      <span>None</span>
      <span className="flex gap-0.5">
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span
            key={level}
            className={cn('size-3 rounded-[3px]', densityClass(level))}
          />
        ))}
      </span>
      <span>Complete</span>
    </div>
  );
}
