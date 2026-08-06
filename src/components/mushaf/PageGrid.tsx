'use client'

import { useOptimistic, useTransition } from 'react'
import { togglePage } from '@/app/actions/memorisation'

type Props = {
  initialMemorised: number[]
  totalPages?: number
}

export function PageGrid({ initialMemorised, totalPages = 604 }: Props) {
  const [optimisticMemorised, addOptimistic] = useOptimistic(
    new Set(initialMemorised),
    (state: Set<number>, page: number) => {
      const next = new Set(state)
      if (next.has(page)) next.delete(page)
      else next.add(page)
      return next
    }
  )

  const [, startTransition] = useTransition()

  function handleToggle(page: number) {
    startTransition(async () => {
      addOptimistic(page)
      await togglePage(page)
    })
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
        const memorised = optimisticMemorised.has(page)
        return (
          <button
            key={page}
            onClick={() => handleToggle(page)}
            aria-label={`Page ${page}${memorised ? ' — memorised' : ''}`}
            aria-pressed={memorised}
            className={[
              'aspect-square rounded text-xs font-medium transition-colors',
              memorised
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            ].join(' ')}
          >
            {page}
          </button>
        )
      })}
    </div>
  )
}