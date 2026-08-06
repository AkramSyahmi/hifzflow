'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, MailCheck } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from '@/lib/constants';

import { signUpAction } from '../actions/auth-actions';
import { signUpSchema, type SignUpInput } from '../schemas/auth-schemas';
import { PasswordField } from './password-field';
import { SubmitButton } from './submit-button';

/**
 * Read the browser's IANA timezone at submit time.
 *
 * Captured silently rather than asked for: every streak, daily target and
 * review queue resolves against the user's local midnight, and nobody knows
 * their own IANA identifier. Settings lets them change it later.
 */
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function SignUpForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      timezone: DEFAULT_TIMEZONE,
      locale: DEFAULT_LOCALE,
    },
  });

  function onSubmit(values: SignUpInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await signUpAction({
        ...values,
        timezone: detectTimezone(),
      });

      if (result.success) {
        setSubmittedEmail(values.email);
        return;
      }

      setFormError(result.error);
      for (const [field, messages] of Object.entries(
        result.fieldErrors ?? {}
      )) {
        form.setError(field as keyof SignUpInput, { message: messages[0] });
      }
    });
  }

  if (submittedEmail) {
    return (
      <Alert variant="success">
        <MailCheck />
        <AlertTitle>Check your inbox</AlertTitle>
        <AlertDescription>
          <p>
            We sent a confirmation link to{' '}
            <span className="font-medium text-foreground">
              {submittedEmail}
            </span>
            . Open it to finish setting up your account.
          </p>
          <p>The link expires in 24 hours.</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {formError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="name"
                  placeholder="Your name"
                  disabled={pending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={pending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordField
                  {...field}
                  autoComplete="new-password"
                  disabled={pending}
                />
              </FormControl>
              <FormDescription>
                At least 10 characters. A short phrase works better than a
                complicated word.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <SubmitButton pending={pending} pendingLabel="Creating account">
          Create account
        </SubmitButton>
      </form>
    </Form>
  );
}
