'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { deleteAccountAction } from '../actions/settings-actions';

const PHRASE = 'delete my account';

export function DeleteAccount() {
  const t = useTranslations('settings.danger');
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [pending, startTransition] = useTransition();

  const matches = confirmation.trim().toLowerCase() === PHRASE;

  function remove() {
    startTransition(async () => {
      // On success the action redirects, so control does not return here.
      const result = await deleteAccountAction({ confirmation });
      if (result && !result.success) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertDescription>
          <p>{t('warning')}</p>
          <p>{t('exportFirst')}</p>
        </AlertDescription>
      </Alert>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">
            {t('delete')}
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('warning')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">
              {t('confirmLab', { phrase: `"${PHRASE}"` })}
            </Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              disabled={pending}
            />
          </div>

          <DialogFooter>
            <Button
              variant="destructive"
              onClick={remove}
              disabled={pending || !matches}
            >
              {pending ? t('deleting') : t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
