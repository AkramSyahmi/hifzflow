import { Badge } from '@/components/ui/badge';

import { lastReviewedLabel } from '../lib/local-date';
import type { PageReviewState } from '../queries/get-murajaah';

/**
 * Pages whose last recorded confidence was at or below the plan's threshold.
 *
 * Shown separately from the queue because the queue only ever contains a
 * capped number of them. Seeing the full list is what tells someone whether
 * they have a handful of soft spots or a systemic problem.
 */
export function WeakPages({ pages }: { pages: readonly PageReviewState[] }) {
  if (pages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No weak pages. Anything you rate at or below your threshold shows up
        here and gets pulled forward in the queue.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {pages.map((page) => (
        <li
          key={page.page_number}
          className="flex items-center gap-4 py-2.5 first:pt-0"
        >
          <span className="tabular w-12 shrink-0 text-sm font-medium">
            p.{page.page_number}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm">Juz&apos; {page.juz}</p>
            <p className="text-xs text-muted-foreground">
              {lastReviewedLabel(page.days_since_review)} · {page.review_count}{' '}
              review{page.review_count === 1 ? '' : 's'}
            </p>
          </div>
          <Badge variant="weak">{page.last_confidence}/5</Badge>
        </li>
      ))}
    </ul>
  );
}
