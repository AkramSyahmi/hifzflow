'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { updateProfileAction } from '../actions/settings-actions';
import { profileSchema, type ProfileInput } from '../schemas/settings-schemas';

/**
 * Timezone options come from the runtime's own IANA database rather than a
 * hand-kept list, so they stay correct as zones are added or renamed.
 * `supportedValuesOf` is not in older runtimes, hence the fallback.
 */
function timezoneOptions(current: string): string[] {
  try {
    const all = Intl.supportedValuesOf('timeZone');
    return all.includes(current) ? all : [current, ...all];
  } catch {
    return [current, 'UTC', 'Asia/Kuala_Lumpur', 'Asia/Singapore'];
  }
}

export function ProfileForm({
  displayName,
  timezone,
}: {
  displayName: string;
  timezone: string;
}) {
  const t = useTranslations('settings.profile');
  const [pending, startTransition] = useTransition();
  const zones = timezoneOptions(timezone);

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName, timezone },
  });

  function onSubmit(values: ProfileInput) {
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (!result.success) {
        toast.error(result.error);
        for (const [field, messages] of Object.entries(
          result.fieldErrors ?? {}
        )) {
          form.setError(field as keyof ProfileInput, { message: messages[0] });
        }
        return;
      }
      toast.success(t('saved'));
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('name')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="name"
                  placeholder={t('namePlaceholder')}
                  disabled={pending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('timezone')}</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={pending}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>{t('timezoneHelp')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending}>
          {pending ? t('saving') : t('save')}
        </Button>
      </form>
    </Form>
  );
}
