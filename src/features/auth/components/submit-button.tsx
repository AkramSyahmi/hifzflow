'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Submit control with an explicit pending state.
 *
 * The label changes rather than only showing a spinner, because a spinner
 * alone gives a screen reader nothing to announce.
 */
export function SubmitButton({
  pending,
  children,
  pendingLabel,
  className,
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      className={className ?? 'w-full'}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
