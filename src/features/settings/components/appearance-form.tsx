'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light', icon: Sun, key: 'light' },
  { value: 'dark', icon: Moon, key: 'dark' },
  { value: 'system', icon: Monitor, key: 'system' },
] as const;

export function AppearanceForm() {
  const t = useTranslations('settings.appearance');
  const tTheme = useTranslations('theme');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = mounted && theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={selected}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                selected
                  ? 'border-primary bg-primary/8 text-foreground'
                  : 'hover:bg-accent'
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tTheme(option.key)}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('help')}</p>
    </div>
  );
}
