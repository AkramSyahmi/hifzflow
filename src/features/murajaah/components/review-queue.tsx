'use client';

import { Check, Loader2 } from 'lucide-react';
import { useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { useOutbox } from '@/features/offline';
import { cn } from '@/lib/utils';

import { completeItemAction } from '../actions/murajaah-actions';
import type { QueueItem } from '../queries/get-murajaah';

const TIER_LABEL: Record<QueueItem['tier'], string> = {
  weak: 'Weak',
  sabqi: 'Sabqi',
  manzil: 'Manzil',
};

const TIER_VARIANT: Record<
  QueueItem['tier'],
  'weak' | 'learning' | 'secondary'
> = {
  weak: 'weak',
  sabqi: 'learning',
  manzil: 'secondary',
};

/**
 * Confidence is recorded on a five point scale because that is what drives the
 * weak-page overlay. Asking for it as five labelled buttons rather than a
 * dropdown keeps the whole interaction to a single tap, which matters when
 * someone is working through a dozen pages in one sitting.
 */
const CONFIDENCE = [
  { value: 1, label: '1', hint: 'Very shaky' },
  { value: 2, label: '2', hint: 'Needs work' },
  { value: 3, label: '3', hint: 'Reasonable' },
  { value: 4, label: '4', hint: 'Solid' },
  { value: 5, label: '5', hint: 'Fluent' },
] as const;

function QueueRow({
  item,
  onComplete,
  isPending,
}: {
  item: QueueItem;
  onComplete: (itemId: string, confidence: number) => void;
  isPending: boolean;
}) {
  const done = item.completed_at !== null;

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5 transition-opacity',
        done && 'opacity-55'
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-medium',
          done
            ? 'bg-state-memorised text-state-memorised-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {done ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <span className="tabular">{item.position}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Page {item.page_number}</span>
          <Badge variant={TIER_VARIANT[item.tier]}>
            {TIER_LABEL[item.tier]}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Juz&apos; {item.juz} · opens with {item.opening_surah} ·{' '}
          {item.ayah_count} ayahs
        </p>
      </div>

      {done ? (
        <span className="tabular text-xs text-muted-foreground">
          Rated {item.confidence}/5
        </span>
      ) : (
        <div className="flex items-center gap-1">
          {isPending ? (
            <span className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              Saving
            </span>
          ) : (
            CONFIDENCE.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onComplete(item.item_id, option.value)}
                title={option.hint}
                aria-label={`Page ${item.page_number}: ${option.hint}`}
                className={cn(
                  'tabular size-8 rounded-md border text-xs font-medium transition-colors',
                  'hover:border-primary hover:bg-primary hover:text-primary-foreground',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
                )}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </li>
  );
}

export function ReviewQueue({ items }: { items: readonly QueueItem[] }) {
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const { online, queue } = useOutbox();

  const [optimisticItems, applyOptimistic] = useOptimistic(
    items,
    (state, change: { itemId: string; confidence: number }) =>
      state.map((entry) =>
        entry.item_id === change.itemId
          ? {
              ...entry,
              completed_at: new Date().toISOString(),
              confidence: change.confidence,
            }
          : entry
      )
  );

  function complete(itemId: string, confidence: number) {
    startTransition(async () => {
      applyOptimistic({ itemId, confidence });
      setPending((current) => new Set(current).add(itemId));

      /*
       * Offline ratings go to the outbox. `complete_queue_item` returns the
       * existing session when an item is already complete, so replaying a
       * queued rating after a partial sync is harmless.
       */
      if (!online) {
        await queue('complete-review', { itemId, confidence });
        setPending((current) => {
          const next = new Set(current);
          next.delete(itemId);
          return next;
        });
        return;
      }

      const result = await completeItemAction({ itemId, confidence });

      setPending((current) => {
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });

      if (!result.success) {
        await queue('complete-review', { itemId, confidence });
        toast.error(result.error);
      }
    });
  }

  const remaining = optimisticItems.filter(
    (item) => item.completed_at === null
  ).length;

  return (
    <div>
      <ul className="divide-y divide-border">
        {optimisticItems.map((item) => (
          <QueueRow
            key={item.item_id}
            item={item}
            onComplete={complete}
            isPending={pending.has(item.item_id)}
          />
        ))}
      </ul>

      {remaining === 0 && optimisticItems.length > 0 ? (
        <p className="mt-4 text-sm font-medium text-state-memorised">
          Today&apos;s murajaah is done.
        </p>
      ) : null}
    </div>
  );
}
