import { cn } from '@/lib/utils';

export interface Stat {
  label: string;
  value: string;
  detail?: string;
}

export function StatGrid({
  stats,
  className,
}: {
  stats: readonly Stat[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        // One slab ruled into cells, matching ProgressStats.
        'grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-3 xl:grid-cols-6',
        className
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="bg-card px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">
            {stat.label}
          </p>
          <p className="tabular mt-1.5 font-display text-2xl leading-none font-bold tracking-tight">
            {stat.value}
          </p>
          {stat.detail ? (
            <p className="tabular mt-0.5 text-xs text-muted-foreground">
              {stat.detail}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
