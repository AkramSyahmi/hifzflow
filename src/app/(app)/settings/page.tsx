import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { requireUser } from '@/features/auth/server';
import { getProfile } from '@/features/profile/server';
import {
  AppearanceForm,
  DataSection,
  DeleteAccount,
  LanguageForm,
  ProfileForm,
  RemindersForm,
  SettingsSection,
} from '@/features/settings';
import {
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

function asLocale(value: string | undefined): Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value ?? '')
    ? (value as Locale)
    : DEFAULT_LOCALE;
}

export default async function SettingsPage() {
  const [user, profile, t] = await Promise.all([
    requireUser(),
    getProfile(),
    getTranslations('settings'),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <SettingsSection
        title={t('profile.title')}
        description={t('profile.description')}
      >
        <ProfileForm
          displayName={profile?.display_name ?? ''}
          timezone={profile?.timezone ?? DEFAULT_TIMEZONE}
        />
        <p className="mt-4 text-xs text-muted-foreground">
          Signed in as {user.email}. Changing your email is not supported yet.
        </p>
      </SettingsSection>

      <SettingsSection
        title={t('language.title')}
        description={t('language.description')}
      >
        <LanguageForm locale={asLocale(profile?.locale)} />
      </SettingsSection>

      <SettingsSection
        title={t('appearance.title')}
        description={t('appearance.description')}
      >
        <AppearanceForm />
      </SettingsSection>

      <SettingsSection
        title={t('reminders.title')}
        description={t('reminders.description')}
      >
        <RemindersForm
          enabled={profile?.reminder_enabled ?? false}
          time={profile?.reminder_time ?? '05:30'}
          days={profile?.reminder_days ?? [0, 1, 2, 3, 4, 5, 6]}
        />
      </SettingsSection>

      <SettingsSection
        title={t('data.title')}
        description={t('data.description')}
      >
        <DataSection />
      </SettingsSection>

      <SettingsSection
        title={t('danger.title')}
        description={t('danger.description')}
        destructive
      >
        <DeleteAccount />
      </SettingsSection>
    </div>
  );
}
