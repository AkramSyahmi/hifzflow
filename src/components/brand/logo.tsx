import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

/**
 * Brand mark.
 *
 * Four stacked rules of decreasing weight: a page of the mushaf seen in
 * profile, and a miniature of the density strip used across the app to show
 * how much of a range is committed to memory.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('size-6', className)}
    >
      <rect x="3" y="4" width="18" height="2.6" rx="1.3" fill="currentColor" />
      <rect
        x="3"
        y="9"
        width="18"
        height="2.6"
        rx="1.3"
        fill="currentColor"
        opacity="0.7"
      />
      <rect
        x="3"
        y="14"
        width="12"
        height="2.6"
        rx="1.3"
        fill="currentColor"
        opacity="0.42"
      />
      <rect
        x="3"
        y="19"
        width="6.5"
        height="2.6"
        rx="1.3"
        fill="currentColor"
        opacity="0.22"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="text-primary" />
      <span className="font-display text-base font-semibold tracking-tight">
        {APP_NAME}
      </span>
    </span>
  );
}
