/**
 * Public client-safe surface of the auth feature.
 *
 * Server-only exports live in `./server`. Keeping them apart is what stops a
 * Client Component that imports one symbol from pulling `server-only` modules
 * into the browser bundle — which fails the build rather than shipping, but
 * only because the split exists.
 */
export { AuthCard } from './components/auth-card';
export { AuthDivider } from './components/auth-divider';
export { ForgotPasswordForm } from './components/forgot-password-form';
export { GoogleButton } from './components/google-button';
export { ResetPasswordForm } from './components/reset-password-form';
export { SignInForm } from './components/sign-in-form';
export { SignUpForm } from './components/sign-up-form';
export { signOutAction } from './actions/auth-actions';
