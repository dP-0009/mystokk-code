import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { User } from '@supabase/supabase-js';
import { supabase } from './client';
import { Platform } from 'react-native';

/**
 * Authentication service for MyStokk (spec §3).
 *
 * Custom 6-digit OTP flow (NOT Supabase magic links), 10-minute expiry:
 *   - OTP generation + storage + Resend delivery happen SERVER-SIDE in the
 *     `send-email` Edge Function (service role + Resend key). The client never
 *     generates or reads OTP codes — `otp_codes` has RLS with no client policy.
 *   - Verification goes through the `verify_email_otp` SECURITY DEFINER RPC.
 *
 * Email is lowercased before every query/uniqueness check (spec §7.1).
 *
 * ⚠️ Required Supabase dashboard config:
 *   Authentication → Providers → Email → turn OFF "Confirm email".
 *   We verify with our own OTP, so signUp must return a session immediately.
 */

export type OtpPurpose = 'signup' | 'reset';
export type PostAuthRoute = 'Onboarding' | 'Dashboard';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Ask the server to generate + email a fresh OTP for this address. */
async function sendOtp(email: string, purpose: OtpPurpose): Promise<void> {
  const { error } = await supabase.functions.invoke('send-email', {
    body: { type: 'otp', purpose, email: normalizeEmail(email) },
  });
  if (error) throw error;
}

/**
 * Request a signup verification code (generated + stored + emailed server-side).
 * Called from the Signup screen BEFORE the account exists, so abandoning the
 * OTP step never leaves an orphan unverified account.
 */
export async function requestSignupOtp(email: string): Promise<void> {
  await sendOtp(normalizeEmail(email), 'signup');
}

/**
 * Create the account. Called only AFTER the signup OTP is verified. With
 * "Confirm email" OFF in Supabase this returns a session immediately, the
 * auto-create trigger inserts the vendor row, and the reactive navigator
 * routes on to Onboarding.
 */
export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({ email: normalizeEmail(email), password });
  if (error) throw error;
}

/** Verify a 6-digit OTP. Returns true if valid (and consumes the code). */
export async function verifyOtp(
  email: string,
  code: string,
  purpose: OtpPurpose = 'signup',
): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_email_otp', {
    p_email: normalizeEmail(email),
    p_code: code,
    p_purpose: purpose,
  });
  if (error) throw error;
  return (data as boolean | null) === true;
}

/** Standard email + password sign-in. */
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error) throw error;
}

/**
 * Google OAuth via PKCE. Opens the system auth session, exchanges the returned
 * code for a session, then marks the vendor as a Google account. Google
 * guarantees the email is verified, so the OTP step is skipped entirely (§3.2).
 * Identity linking for an existing password account is handled by Supabase Auth.
 */
export async function signInWithGoogle(): Promise<void> {
  const isWeb = Platform.OS === 'web';
  const redirectTo = isWeb ? window.location.origin : Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // We drive the redirect ourselves on web and capture it in WebBrowser on
      // native, so don't let supabase-js auto-navigate the page.
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Could not start Google sign-in.');

    if (isWeb) {
        window.location.href = data.url;
        return;
    }

    const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
    );

    if (result.type !== 'success' || !result.url) {
        throw new Error('Google sign-in was cancelled.');
    }

    const { queryParams } = Linking.parse(result.url);
    const code = queryParams?.code;

    if (typeof code !== 'string') {
        throw new Error('Google sign-in did not return an authorization code.');
    }

    const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) throw exchangeError;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { error: updateError } = await supabase
      .from('vendors')
      .update({ auth_provider: 'google' })
      .eq('id', user.id);
    if (updateError) throw updateError;
  }
}

/** Send a password-reset OTP (same pattern as signup, purpose='reset'). */
export async function requestPasswordReset(email: string): Promise<void> {
  await sendOtp(normalizeEmail(email), 'reset');
}

/**
 * Reset the password using a verified OTP. The user is logged OUT during reset,
 * so verification + the password change run server-side with the service role
 * in the `reset-password` Edge Function (which calls verify_email_otp, then the
 * admin API). A logged-out client cannot call supabase.auth.updateUser itself.
 */
export async function resetPasswordWithOtp(
  email: string,
  otp: string,
  newPassword: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke('reset-password', {
    body: { email: normalizeEmail(email), otp, newPassword },
  });
  if (error) throw error;
}

/**
 * After successful auth/verification, decide where to route:
 * Onboarding if the vendor hasn't onboarded yet, otherwise Dashboard (§3.1/§3.4).
 */
export async function getPostAuthRoute(): Promise<PostAuthRoute> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { data, error } = await supabase
    .from('vendors')
    .select('onboarded')
    .eq('id', user.id)
    .single();
  if (error) throw error;

  return (data as { onboarded: boolean }).onboarded ? 'Dashboard' : 'Onboarding';
}

/** Current signed-in user (or null). */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Change the signed-in user's password (Supabase updates the active session). */
export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Sign out and clear the persisted session from the Keychain. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
