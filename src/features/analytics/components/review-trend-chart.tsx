'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ReviewTrendPoint } from '../queries/get-analytics';

function formatWeek(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T00:00:00Z`));
}

const SERIES = [
  { key: 'manzil_reviews', name: 'Manzil', colour: 'var(--chart-1)' },
  { key: 'sabqi_reviews', name: 'Sabqi', colour: 'var(--chart-2)' },
  { key: 'weak_reviews', name: 'Weak', colour: 'var(--chart-3)' },
] as const;

/**
 * Weekly review volume by tier, with mean confidence on a second axis.
 *
 * The two together answer a question neither answers alone: whether volume and
 * quality are moving in the same direction. Volume rising while confidence
 * falls is the signature of a daily budget set too high, and it is invisible on
 * either chart in isolation.
 */
export function ReviewTrendChart({
  data,
}: {
  data: readonly ReviewTrendPoint[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data as ReviewTrendPoint[]}
          margin={{ top: 8, right: 4, bottom: 0, left: -16 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="week_start"
            tickFormatter={formatWeek}
            minTickGap={28}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
          <YAxis
            yAxisId="volume"
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
          <YAxis
            yAxisId="confidence"
            orientation="right"
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tickLine={false}
            axisLine={false}
            width={28}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--popover-foreground)',
            }}
            labelFormatter={(value) => `Week of ${formatWeek(String(value))}`}
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }}
          />

          {SERIES.map((series) => (
            <Bar
              key={series.key}
              yAxisId="volume"
              dataKey={series.key}
              name={series.name}
              stackId="tiers"
              fill={series.colour}
              radius={series.key === 'weak_reviews' ? [3, 3, 0, 0] : undefined}
              maxBarSize={28}
            />
          ))}

          <Line
            yAxisId="confidence"
            type="monotone"
            dataKey="average_confidence"
            name="Confidence"
            stroke="var(--foreground)"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
