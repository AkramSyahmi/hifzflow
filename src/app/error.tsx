'use client';

import { useEffect } from 'react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replaced by the error reporting client in the deployment milestone.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Something broke on our side
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your data is safe. Try again, and if it keeps happening the reference
          below will help us track it down.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">
            Reference {error.digest}
          </p>
        ) : null}
      </div>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
