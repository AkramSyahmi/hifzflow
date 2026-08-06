import { Card, CardContent } from '@/components/ui/card';
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
        'grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6',
        className
      )}
    >
      {stats.map((stat) => (
        <Card key={stat.label} className="gap-0 py-4">
          <CardContent className="px-4">
            <p className="text-xs font-medium text-muted-foreground">
              {stat.label}
            </p>
            <p className="tabular mt-1 font-display text-xl font-semibold tracking-tight">
              {stat.value}
            </p>
            {stat.detail ? (
              <p className="tabular mt-0.5 text-xs text-muted-foreground">
                {stat.detail}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
