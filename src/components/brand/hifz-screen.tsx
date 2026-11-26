'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

import { SCREEN_OPENING, type ScreenState } from './screen-states';

/** First page of each juz' in the Madani mushaf (604 pages). */
const JUZ_START = [
  1, 22, 42, 63, 82, 102, 122, 142, 162, 182, 202, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 503, 522, 542, 562, 582,
] as const;

const LAST_PAGE = 604;

const ROWS = JUZ_START.map((start, index) => {
  const end = (JUZ_START[index + 1] ?? LAST_PAGE + 1) - 1;
  return {
    juz: index + 1,
    pages: range(start, end),
  };
});

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/*
 * Example data for the landing page only, labelled as such where it renders:
 * a hafiz with Juz' 1, 29 and 30 held (manzil), pages 22-30 memorised in the
 * last month (sabqi), and two pages rated weak.
 */
const MANZIL = [...range(1, 21), ...range(562, 604)];
const SABQI = range(22, 30);
const WEAK = [571, 590];
const MANZIL_SET = new Set(MANZIL);
const SABQI_SET = new Set(SABQI);
const WEAK_SET = new Set(WEAK);

/*
 * A four-page day, the way the scheduler builds it: two pages of manzil
 * continuing the rotation, one sabqi page, and one weak page pulled forward.
 * Weak is one page in four, inside the one-third cap.
 */
const MANZIL_PER_DAY = 2;

function dayPlan(day: number) {
  const offset = (day * MANZIL_PER_DAY) % MANZIL.length;
  return {
    manzil: MANZIL.slice(offset, offset + MANZIL_PER_DAY),
    sabqi: SABQI[day % SABQI.length]!,
    weak: WEAK[day % WEAK.length]!,
  };
}

function stateOf(page: number): ScreenState {
  if (WEAK_SET.has(page)) return 'weak';
  if (SABQI_SET.has(page)) return 'sabqi';
  if (MANZIL_SET.has(page)) return 'manzil';
  return 'none';
}

const STATE_LABEL: Record<ScreenState, string> = {
  manzil: 'memorised, in the manzil rotation',
  sabqi: 'memorised this month (sabqi)',
  weak: 'rated weak',
  none: 'not memorised yet',
};

function juzOf(page: number): number {
  return JUZ_START.filter((start) => start <= page).length;
}

/**
 * The mushaf as a breeze-block screen: one block per page, one row per juz'.
 * Light comes through memorised pages. Today's pages carry a white frame and
 * step through the rotation, slowly, the way the manzil cycle moves day by
 * day. Arrow keys or a tap name any page.
 */
export function HifzScreen({ className }: { className?: string }) {
  const [day, setDay] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setDay((d) => d + 1), 6000);
    return () => window.clearInterval(timer);
  }, []);

  const plan = dayPlan(day);
  const today = new Set([...plan.manzil, plan.sabqi, plan.weak]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const across: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    const down: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
    if (!(event.key in across) && !(event.key in down)) return;
    event.preventDefault();

    setCursor((current) => {
      const page = current ?? plan.manzil[0]!;
      if (event.key in across) {
        return Math.min(LAST_PAGE, Math.max(1, page + across[event.key]!));
      }
      // Up and down keep the column, so the cursor lands on the block
      // visibly above or below; a shorter juz' row clamps to its last page.
      const row = juzOf(page) - 1;
      const column = page - ROWS[row]!.pages[0]!;
      const target =
        ROWS[Math.min(ROWS.length - 1, Math.max(0, row + down[event.key]!))]!;
      return target.pages[Math.min(column, target.pages.length - 1)]!;
    });
  }

  return (
    <figure className={cn('flex flex-col gap-6', className)}>
      <div>
        <p className="text-sm font-medium text-white/80">
          Today&apos;s murajaah starts at page
        </p>
        <p className="tabular font-display text-[clamp(4.5rem,8vw,7.5rem)] leading-[0.9] font-bold text-white">
          {plan.manzil[0]}
        </p>
        <p className="tabular mt-3 text-sm text-white/80">
          Manzil {plan.manzil.join(', ')} · sabqi {plan.sabqi} · weak{' '}
          {plan.weak}
        </p>
      </div>

      <div
        tabIndex={0}
        role="group"
        aria-label="Example hifz: all 604 pages, one row per juz'. Use the arrow keys to name a page."
        aria-describedby="hifz-screen-caption"
        className="grid gap-[2px] rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-roof"
        onKeyDown={onKeyDown}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setCursor(null);
        }}
      >
        {ROWS.map((row) => (
          <div
            key={row.juz}
            className="grid grid-cols-[1.5rem_repeat(23,minmax(0,1fr))] items-center gap-[2px]"
          >
            <span className="tabular text-[10px] leading-none text-white/60">
              {row.juz % 5 === 0 || row.juz === 1 ? row.juz : ''}
            </span>
            {row.pages.map((page) => (
              <span
                key={page}
                onPointerEnter={() => setCursor(page)}
                onPointerDown={() => setCursor(page)}
                className={cn(
                  'relative aspect-square transition-colors duration-700',
                  // Concrete frame; today's pages are framed in white.
                  today.has(page) ? 'bg-white' : 'bg-white/18',
                  cursor === page && 'outline-2 outline-white'
                )}
              >
                <span
                  className={cn(
                    'breeze-opening absolute inset-0 transition-colors duration-700',
                    SCREEN_OPENING[stateOf(page)]
                  )}
                />
              </span>
            ))}
          </div>
        ))}
      </div>

      <figcaption
        id="hifz-screen-caption"
        aria-live="polite"
        className="tabular min-h-5 text-xs text-white/75"
      >
        {cursor === null
          ? 'Example hifz. Point at, tap or arrow through any page.'
          : `Page ${cursor} · Juz' ${juzOf(cursor)} · ${STATE_LABEL[stateOf(cursor)]}${
              today.has(cursor) ? ' · in today’s review' : ''
            }`}
      </figcaption>
    </figure>
  );
}
