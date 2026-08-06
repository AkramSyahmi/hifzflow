'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { checkRateLimit } from '@/lib/rate-limit/rate-limit';
import { DEFAULT_SIGNED_IN_PATH } from '@/lib/supabase/middleware';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import type { ActionResult } from '@/types';

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '../schemas/auth-schemas';

/**
 * Auth Server Actions.
 *
 * Every action that can be reached without a session is rate limited against
 * both the submitted identifier and the caller's address. Server Actions have
 * no limiting of their own, and these are the endpoints brute force arrives at.
 * Supabase Auth applies its own limits underneath, so the two are layered.
 */

/**
 * Restricts post-auth redirects to same-origin paths.
 *
 * Without this, `?next=https://evil.example` turns the sign-in page into an
 * open redirect — a phishing primitive that looks like it came from us.
 */
function safeRedirectPath(candidate: string | undefined | null): string {
  if (!candidate) return DEFAULT_SIGNED_IN_PATH;
  if (!candidate.startsWith('/')) return DEFAULT_SIGNED_IN_PATH;
  if (candidate.startsWith('//')) return DEFAULT_SIGNED_IN_PATH;
  return candidate;
}

function fieldErrorsFrom(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  const flattened = error.flatten().fieldErrors;
  const cleaned: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(flattened)) {
    if (value?.length) cleaned[key] = value;
  }
  return cleaned;
}

export async function signInAction(
  values: unknown,
  next?: string
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const limit = await checkRateLimit('sign_in', parsed.data.email);
  if (!limit.allowed) {
    return { success: false, error: limit.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately uniform: distinguishing "no such account" from "wrong
    // password" tells an attacker which addresses are registered.
    if (error.code === 'email_not_confirmed') {
      return {
        success: false,
        error:
          'Confirm your email address first. Check your inbox for the link we sent.',
      };
    }
    return {
      success: false,
      error: 'That email and password combination is not correct.',
    };
  }

  revalidatePath('/', 'layout');
  redirect(safeRedirectPath(next));
}

export async function signUpAction(values: unknown): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const { email, password, displayName, timezone, locale } = parsed.data;

  const limit = await checkRateLimit('sign_up', email);
  if (!limit.allowed) {
    return { success: false, error: limit.message };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
      // Read by the handle_new_user() trigger to seed the profile row.
      data: { display_name: displayName, timezone, locale },
    },
  });

  if (error) {
    if (error.code === 'over_email_send_rate_limit') {
      return {
        success: false,
        error: 'Too many attempts. Wait a minute and try again.',
      };
    }
    return {
      success: false,
      error: 'We could not create that account. Try again in a moment.',
    };
  }

  // Supabase returns a user with an empty identities array when the address is
  // already registered. Reporting that back would confirm the address exists,
  // so the response is identical either way and the real owner gets an email.
  const alreadyRegistered = data.user?.identities?.length === 0;
  if (alreadyRegistered) {
    return { success: true, data: undefined };
  }

  return { success: true, data: undefined };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/sign-in');
}

export async function signInWithGoogleAction(next?: string): Promise<void> {
  const supabase = await createClient();
  const redirectPath = safeRedirectPath(next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(redirectPath)}`,
      queryParams: {
        // Ask for a refresh token and force the account chooser, so users with
        // several Google accounts are not silently signed into the wrong one.
        access_type: 'offline',
        prompt: 'consent select_account',
      },
    },
  });

  if (error || !data.url) {
    redirect('/sign-in?error=oauth');
  }

  redirect(data.url);
}

export async function requestPasswordResetAction(
  values: unknown
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the field below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  // Tightest limit of the four: every attempt sends an email to a third party,
  // so abuse here is abuse of someone else's inbox.
  const limit = await checkRateLimit('password_reset', parsed.data.email);
  if (!limit.allowed) {
    return { success: false, error: limit.message };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?type=recovery`,
  });

  // Always reports success. A different response for unregistered addresses
  // would turn this form into an account-enumeration oracle.
  return { success: true, data: undefined };
}

export async function updatePasswordAction(
  values: unknown
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Check the fields below.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = await createClient();

  // The recovery link established a session, so this call is authenticated.
  // Without a valid session it fails, which is what stops a stranger from
  // setting a password on someone else's account.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'That reset link has expired. Request a new one.',
    };
  }

  const limit = await checkRateLimit('password_update', user.id);
  if (!limit.allowed) {
    return { success: false, error: limit.message };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === 'same_password') {
      return {
        success: false,
        error: 'Choose a password you have not used here before.',
      };
    }
    return {
      success: false,
      error: 'We could not update your password. Try again.',
    };
  }

  revalidatePath('/', 'layout');
  redirect(`${DEFAULT_SIGNED_IN_PATH}?password=updated`);
}
