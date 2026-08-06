'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import * as React from 'react';

import { Button } from '@/components/ui/button';

/**
 * Theme switch.
 *
 * Renders a disabled placeholder until mounted: `next-themes` cannot know the
 * resolved theme during SSR, and rendering the wrong icon first causes a
 * visible flip on hydration.
 */
export function ThemeToggle() {
  const t = useTranslations('theme');
  const [mounted, setMounted] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-hidden="true"
        className="opacity-0"
      >
        <Sun />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? t('toLight') : t('toDark')}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
