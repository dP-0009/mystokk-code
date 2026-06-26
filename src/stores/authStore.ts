import { Platform } from 'react-native';
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase/client';

/**
 * Web only: after Google's full-page redirect we land back on our origin with
 * `?code=...` (PKCE). Exchange it for a session here — deterministically, before
 * we read the session — then scrub the auth params from the URL so a refresh
 * doesn't try to re-exchange a spent code. Errors are thrown so the caller can
 * surface them instead of silently leaving the user signed out.
 */
async function consumeWebOAuthRedirect(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const errorDescription = url.searchParams.get('error_description');

  const clean = (): void => {
    url.searchParams.delete('code');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    url.searchParams.delete('state');
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  };

  if (errorDescription) {
    clean();
    throw new Error(errorDescription);
  }
  if (!code) return;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  clean();
  if (error) throw error;
}

/**
 * Auth store — the single source of truth for route gating (spec §3.4).
 *
 *   status 'loading'   → still resolving the session / vendor row
 *   status 'signedOut' → show the auth stack
 *   status 'signedIn'  → vendor.onboarded decides Onboarding vs Main tabs
 *
 * `profileComplete` is exposed so the Share action can be gated at the ACTION
 * level (not the route level) — see selectCanShare.
 */

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface VendorFlags {
  onboarded: boolean;
  profileComplete: boolean;
}

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  vendor: VendorFlags | null;
  /** A share token captured pre-auth (from a public link), claimed after sign-in. */
  pendingShareToken: string | null;
  setPendingShareToken: (token: string | null) => void;
  initialize: () => Promise<void>;
  refreshVendor: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,
  vendor: null,
  pendingShareToken: null,
  setPendingShareToken: (token) => set({ pendingShareToken: token }),

  initialize: async () => {
    // Complete a Google web sign-in (?code= → session) before reading the session.
    // Never let a failure here wedge the app on the loading screen — log and fall
    // through to signedOut so the user can retry.
    try {
      await consumeWebOAuthRedirect();
    } catch (err) {
      console.error('[auth] Google sign-in could not be completed:', err);
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    set({ session, status: session ? 'signedIn' : 'signedOut' });
    if (session) await get().refreshVendor();

    // React to future sign-in/out. Defer the supabase calls to the next tick —
    // calling supabase-js inside this callback synchronously can deadlock.
    supabase.auth.onAuthStateChange((_event, newSession) => {
      set({ session: newSession, status: newSession ? 'signedIn' : 'signedOut' });
      setTimeout(() => {
        if (newSession) {
          void get().refreshVendor();
        } else {
          set({ vendor: null });
        }
      }, 0);
    });
  },

  refreshVendor: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      set({ vendor: null });
      return;
    }
    const { data, error } = await supabase
      .from('vendors')
      .select('onboarded, profile_complete')
      .eq('id', user.id)
      .single();
    if (error || !data) {
      set({ vendor: null });
      return;
    }
    const row = data as { onboarded: boolean; profile_complete: boolean };
    set({ vendor: { onboarded: row.onboarded, profileComplete: row.profile_complete } });
  },

  signOut: async () => {
    // Clear the server session, but never let a network/error leave the user
    // stranded signed-in: always drop local state so the navigator returns to
    // the auth stack. onAuthStateChange(SIGNED_OUT) will also fire as a backup.
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[auth] signOut request failed; clearing session locally:', err);
    } finally {
      set({ session: null, vendor: null, status: 'signedOut' });
    }
  },
}));

/** The Share action is allowed only once the vendor's profile is complete (§3.4). */
export const selectCanShare = (state: AuthState): boolean =>
  state.status === 'signedIn' && state.vendor?.profileComplete === true;
