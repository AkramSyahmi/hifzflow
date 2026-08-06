import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard, ForgotPasswordForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Request a password reset link for your HifzFlow account.',
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we will send you a link to set a new one."
      footer={
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
