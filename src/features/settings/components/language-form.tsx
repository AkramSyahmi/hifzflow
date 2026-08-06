'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/constants';

import { updateLocaleAction } from '../actions/settings-actions';

const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ms: 'Bahasa Malaysia',
};

export function LanguageForm({ locale }: { locale: Locale }) {
  const t = useTranslations('settings.language');
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Label htmlFor="locale">{t('label')}</Label>
      <Select
        value={locale}
        disabled={pending}
        onValueChange={(value) => {
          startTransition(async () => {
            const result = await updateLocaleAction({ locale: value });
            if (!result.success) toast.error(result.error);
            else toast.success(t('changed'));
          });
        }}
      >
        <SelectTrigger id="locale" className="sm:max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LOCALES.map((value) => (
            <SelectItem key={value} value={value}>
              {LOCALE_NAMES[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t('help')}</p>
    </div>
  );
}
