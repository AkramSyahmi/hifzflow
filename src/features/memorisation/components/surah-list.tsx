import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { SurahProgress } from '../queries/get-progress';

export interface SurahRow {
  number: number;
  name_transliterated: string;
  name_arabic: string;
  ayah_count: number;
  revelation_place: string;
}

/**
 * Every surah with its progress. Surahs with no progress are shown too — the
 * list is as much for deciding what to start as for reviewing what is done.
 */
export function SurahList({
  surahs,
  progress,
}: {
  surahs: readonly SurahRow[];
  progress: readonly SurahProgress[];
}) {
  const byNumber = new Map(progress.map((row) => [row.surah_number, row]));

  return (
    <ul className="divide-y divide-border">
      {surahs.map((surah) => {
        const row = byNumber.get(surah.number);
        const memorised = row?.memorised_ayahs ?? 0;
        const percent = Math.round((memorised / surah.ayah_count) * 100);
        const complete = memorised >= surah.ayah_count;

        return (
          <li
            key={surah.number}
            className="flex items-center gap-4 py-2.5 first:pt-0"
          >
            <span className="tabular w-8 shrink-0 text-right text-xs text-muted-foreground">
              {surah.number}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium">
                  {surah.name_transliterated}
                </span>
                <span lang="ar" className="text-sm text-muted-foreground">
                  {surah.name_arabic}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    complete ? 'bg-state-memorised' : 'bg-hifz-3'
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            <div className="w-28 shrink-0 text-right">
              {complete ? (
                <Badge variant="memorised">Complete</Badge>
              ) : memorised > 0 ? (
                <span className="tabular text-xs text-muted-foreground">
                  {memorised} / {surah.ayah_count}
                </span>
              ) : (
                <span className="tabular text-xs text-muted-foreground/60">
                  {surah.ayah_count} ayahs
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
