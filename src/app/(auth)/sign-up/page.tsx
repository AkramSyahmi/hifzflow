import type { Metadata } from 'next';
import Link from 'next/link';

import {
  AuthCard,
  AuthDivider,
  GoogleButton,
  SignUpForm,
} from '@/features/auth';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Start planning your hifz and murajaah with HifzFlow.',
};

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Set up your memorisation plan in a few minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/sign-in"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton label="Sign up with Google" />
      <AuthDivider />
      <SignUpForm />
    </AuthCard>
  );
}
