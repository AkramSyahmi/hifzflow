'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { exportDataAction } from '../actions/settings-actions';

export function DataSection() {
  const t = useTranslations('settings.data');
  const [pending, startTransition] = useTransition();

  function download() {
    startTransition(async () => {
      const result = await exportDataAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      // Built and revoked in the same tick. Leaving the object URL alive holds
      // the whole export in memory for the lifetime of the page.
      const blob = new Blob([result.data.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.data.filename;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success(t('exported'));
    });
  }

  return (
    <div className="space-y-3">
      <Button onClick={download} disabled={pending} variant="outline" size="sm">
        <Download />
        {pending ? t('exporting') : t('export')}
      </Button>
      <p className="text-xs text-muted-foreground">{t('exportHelp')}</p>
    </div>
  );
}
