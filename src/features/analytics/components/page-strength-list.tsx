import { Badge } from '@/components/ui/badge';
import { lastReviewedLabel } from '@/features/murajaah';

import type { PageStrength } from '../queries/get-analytics';

/**
 * A ranked list of pages by strength or review count.
 *
 * `emptyMessage` is required rather than defaulted: the reason a list is empty
 * differs between them — too few reviews, or none at all — and a generic
 * "nothing here" tells the user nothing about what to do next.
 */
export function PageStrengthList({
  pages,
  metric,
  emptyMessage,
}: {
  pages: readonly PageStrength[];
  metric: 'strength' | 'reviews';
  emptyMessage: string;
}) {
  if (pages.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {pages.map((page) => (
        <li
          key={page.page_number}
          className="flex items-center gap-3 py-2.5 first:pt-0"
        >
          <span className="tabular w-12 shrink-0 text-sm font-medium">
            p.{page.page_number}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm">Juz&apos; {page.juz}</p>
            <p className="text-xs text-muted-foreground">
              {lastReviewedLabel(page.days_since_review)} · {page.review_count}{' '}
              review{page.review_count === 1 ? '' : 's'}
              {page.average_confidence !== null
                ? ` · mean ${page.average_confidence}`
                : ''}
            </p>
          </div>

          {metric === 'reviews' ? (
            <span className="tabular text-sm font-medium">
              {page.review_count}
            </span>
          ) : (
            <Badge
              variant={
                page.strength === null
                  ? 'outline'
                  : page.strength >= 4
                    ? 'memorised'
                    : page.strength >= 3
                      ? 'learning'
                      : 'weak'
              }
            >
              {page.strength ?? '—'}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
