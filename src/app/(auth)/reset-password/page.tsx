import type { Metadata } from 'next';

import { AuthCard, ResetPasswordForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Set a new password"
      description="Choose something you have not used on this account before."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
