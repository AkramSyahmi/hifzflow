import Link from 'next/link';

import { Logo } from '@/components/brand/logo';

/**
 * Shell shared by every auth screen. Keeps the heading hierarchy, spacing and
 * footer treatment identical across sign-in, sign-up and password recovery,
 * so the flow reads as one continuous surface rather than four pages.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="mb-8 inline-flex">
        <Logo />
      </Link>

      <div className="mb-6 space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      {children}

      {footer ? (
        <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  );
}
