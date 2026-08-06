'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { updateRemindersAction } from '../actions/settings-actions';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function RemindersForm({
  enabled: initialEnabled,
  time: initialTime,
  days: initialDays,
}: {
  enabled: boolean;
  time: string;
  days: readonly number[];
}) {
  const t = useTranslations('settings.reminders');
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [time, setTime] = useState(initialTime.slice(0, 5));
  const [days, setDays] = useState<number[]>([...initialDays]);

  function save() {
    startTransition(async () => {
      const result = await updateRemindersAction({ enabled, time, days });
      if (!result.success) toast.error(result.error);
      else toast.success(t('saved'));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="reminder-enabled">{t('enable')}</Label>
        <button
          id="reminder-enabled"
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={pending}
          onClick={() => setEnabled((current) => !current)}
          className={cn(
            'relative h-6 w-10 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            enabled ? 'bg-primary' : 'bg-input'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 size-5 rounded-full bg-background shadow-sm transition-transform',
              enabled ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      {enabled ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="reminder-time">{t('time')}</Label>
            <Input
              id="reminder-time"
              type="time"
              value={time}
              disabled={pending}
              onChange={(event) => setTime(event.target.value)}
              className="sm:max-w-[10rem]"
            />
            <p className="text-xs text-muted-foreground">{t('timeHelp')}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((label, index) => {
              const selected = days.includes(index);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={pending}
                  aria-pressed={selected}
                  onClick={() =>
                    setDays((current) =>
                      selected
                        ? current.filter((day) => day !== index)
                        : [...current, index]
                    )
                  }
                  className={cn(
                    'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                    selected
                      ? 'border-transparent bg-secondary text-secondary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending} variant="outline" size="sm">
          {pending ? 'Saving' : 'Save reminders'}
        </Button>
        <p className="text-xs text-muted-foreground">{t('pending')}</p>
      </div>
    </div>
  );
}
