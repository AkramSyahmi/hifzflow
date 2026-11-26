import { densityFill } from '@/features/memorisation';
import { cn } from '@/lib/utils';

import {
  activityLabel,
  activityLevel,
  monthLabels,
  toWeeks,
  type ActivityDay,
} from '../lib/activity';

const CELL = 11;
const GAP = 3;
const PITCH = CELL + GAP;
const LABEL_WIDTH = 24;
const LABEL_HEIGHT = 14;

const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

/**
 * A year of activity as a calendar grid.
 *
 * Built as raw SVG rather than with the charting library: Recharts has no
 * calendar layout, and forcing one out of a scatter plot produces worse output
 * than a few hundred rects. Each cell carries a native <title>, so the tooltip
 * needs no JavaScript and is read correctly by screen readers.
 */
export function ActivityHeatmap({
  days,
  className,
}: {
  days: readonly ActivityDay[];
  className?: string;
}) {
  const weeks = toWeeks(days);
  const months = monthLabels(weeks);

  const width = LABEL_WIDTH + weeks.length * PITCH;
  const height = LABEL_HEIGHT + 7 * PITCH;

  const activeDays = days.filter((day) => activityLevel(day) > 0).length;

  return (
    <figure className={cn('space-y-3', className)}>
      {/* Horizontal scroll rather than shrinking: squares below about ten
          pixels stop being readable, and a squashed year is worse than a
          scrollable one. Reversed flex starts the scroll at the newest
          weeks, so today is visible without JavaScript; the SVG's auto
          right margin keeps it left-aligned when it fits. */}
      <div className="-mx-1 flex flex-row-reverse overflow-x-auto px-1 pb-1">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Activity over the last year. ${activeDays} active days.`}
          className="mr-auto block shrink-0"
        >
          {months.map((month) => (
            <text
              key={`${month.label}-${month.column}`}
              x={LABEL_WIDTH + month.column * PITCH}
              y={9}
              className="fill-muted-foreground"
              style={{ fontSize: 9 }}
            >
              {month.label}
            </text>
          ))}

          {WEEKDAYS.map((label, row) =>
            label ? (
              <text
                key={label}
                x={0}
                y={LABEL_HEIGHT + row * PITCH + CELL - 1}
                className="fill-muted-foreground"
                style={{ fontSize: 9 }}
              >
                {label}
              </text>
            ) : null
          )}

          {weeks.map((week, column) =>
            week.map((day, row) =>
              day ? (
                <rect
                  key={day.day}
                  x={LABEL_WIDTH + column * PITCH}
                  y={LABEL_HEIGHT + row * PITCH}
                  width={CELL}
                  height={CELL}
                  rx={2.5}
                  fill={densityFill(activityLevel(day))}
                >
                  <title>{`${day.day} — ${activityLabel(day)}`}</title>
                </rect>
              ) : null
            )
          )}
        </svg>
      </div>

      <figcaption className="sr-only">
        Each square is one day over the past year, shaded by how much was
        reviewed or memorised.
      </figcaption>
    </figure>
  );
}
