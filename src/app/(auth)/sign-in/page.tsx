import type { Metadata } from 'next';
import Link from 'next/link';

import {
  AuthCard,
  AuthDivider,
  GoogleButton,
  SignInForm,
} from '@/features/auth';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your HifzFlow account.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthCard
      title="Sign in"
      description="Pick up where you left off."
      footer={
        <>
          New here?{' '}
          <Link
            href="/sign-up"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton next={params.next} label="Sign in with Google" />
      <AuthDivider />
      <SignInForm next={params.next} />
    </AuthCard>
  );
}
