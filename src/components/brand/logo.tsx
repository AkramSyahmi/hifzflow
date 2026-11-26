import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

/**
 * Brand mark.
 *
 * One breeze block: the perforated concrete unit of 1960s Malaysian screens,
 * with a quatrefoil opening and light showing through it. The page grid
 * across the app is built from the same unit, one block per page.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('size-6', className)}
    >
      <defs>
        <mask id="hifzflow-block">
          <rect width="24" height="24" fill="#fff" />
          <circle cx="12" cy="7.6" r="3.6" fill="#000" />
          <circle cx="12" cy="16.4" r="3.6" fill="#000" />
          <circle cx="7.6" cy="12" r="3.6" fill="#000" />
          <circle cx="16.4" cy="12" r="3.6" fill="#000" />
        </mask>
      </defs>
      <rect x="3" y="3" width="18" height="18" className="fill-sun" />
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        fill="currentColor"
        mask="url(#hifzflow-block)"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="text-primary" />
      <span className="font-display text-base font-bold tracking-tight">
        {APP_NAME}
      </span>
    </span>
  );
}
