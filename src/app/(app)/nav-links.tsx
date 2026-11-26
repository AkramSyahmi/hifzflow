'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type NavLink = { href: string; label: string };

export function NavLinks({
  links,
  className,
  linkClassName,
}: {
  links: NavLink[];
  className?: string;
  linkClassName?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={className}>
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname?.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            // The mobile strip scrolls horizontally; keep the current page in
            // view instead of leaving it past the edge.
            ref={
              isActive
                ? (node) =>
                    node?.scrollIntoView({
                      block: 'nearest',
                      inline: 'nearest',
                    })
                : undefined
            }
            className={cn(
              linkClassName,
              'transition-colors',
              isActive
                ? 'bg-accent font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
