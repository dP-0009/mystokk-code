import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { BrandLoader } from '../components/shared/BrandLoader';

import {
  NavigationContainer,
  createNavigationContainerRef,
  getPathFromState,
  getStateFromPath,
  type LinkingOptions,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/tokens';
import { initPushHandlers, pushTargetTab } from '../services/push';
import { claimShare } from '../services/supabase/shares';
import { toast } from '../stores/toast';
import { MainTabs } from './MainTabs';

import { LandingScreen } from '../screens/LandingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { NewPasswordScreen } from '../screens/NewPasswordScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { InventoryDetailScreen } from '../screens/InventoryDetailScreen';
import { InventoryCreateScreen } from '../screens/InventoryCreateScreen';
import { InventoryEditScreen } from '../screens/InventoryEditScreen';
import { ShareLandingScreen } from '../screens/ShareLandingScreen';
import { ManageSharesScreen } from '../screens/ManageSharesScreen';
import { ReservationDetailScreen } from '../screens/ReservationDetailScreen';
import type { IncomingReservation } from '../services/supabase/reservations';
import { VendorDetailScreen } from '../screens/VendorDetailScreen';
import { EditVendorScreen } from '../screens/EditVendorScreen';
import { AddVendorScreen } from '../screens/AddVendorScreen';
import { BulkUploadScreen } from '../screens/BulkUploadScreen';
import { ReceivedDetailScreen } from '../screens/ReceivedDetailScreen';
import { ReceivedEditScreen } from '../screens/ReceivedEditScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PreferencesScreen } from '../screens/PreferencesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { LegalScreen } from '../screens/LegalScreen';

/** Root stack param list (spec §4.1, plus Profile reached from the dashboard). */
export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  Otp: { email: string; purpose: 'signup' | 'reset' };
  NewPassword: { email: string; otp: string };
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined; // Bottom tabs
  ShareLanding: { token?: string; code?: string }; // public share landing (deep link: /share/:token or /s/:code)
  InventoryDetail: { inventoryId: string };
  InventoryCreate: undefined;
  InventoryEdit: { inventoryId: string };
  ManageShares: { inventoryId: string };
  ReservationDetail: { side: 'incoming' | 'outgoing'; data: IncomingReservation };
  VendorDetail: { vendorId?: string; manualVendorId?: string };
  EditVendor: { vendorId?: string; manualVendorId?: string };
  AddVendor: undefined;
  BulkUpload: undefined;
  ReceivedDetail: { shareId: string };
  ReceivedEdit: { shareId: string };
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Preferences: undefined;
  Notifications: undefined;
  Legal: { page: 'faq' | 'privacy' | 'terms' | 'contact' };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Inventory: undefined;
  Network: undefined;
  Received: undefined;
  Reservations: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Shared ref so the app can navigate after auth (e.g. claim a pending share). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Deep links (spec §4.1). Public share links land on the login-free ShareLanding. */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'mystokk://',
    process.env.EXPO_PUBLIC_APP_URL ?? 'https://mystokk.com',
    'https://mystokk.com',
    'https://www.mystokk.com',
    // Legacy hosts — kept so links shared before the domain switch still open.
    'https://mystokk.vercel.app',
    'https://mystokk.app',
    'https://app.mystokk.com',
  ],
  config: {
    // Every screen has a URL path so the address bar reflects the current screen
    // and a browser refresh restores it (instead of dropping back to the
    // dashboard). Static paths are listed before the dynamic ones they'd shadow.
    screens: {
      // Auth
      Login: 'login',
      Signup: 'signup',
      ForgotPassword: 'forgot-password',
      Otp: 'verify',
      NewPassword: 'reset-password',
      Onboarding: 'onboarding',
      // Main tabs
      Main: {
        screens: {
          Dashboard: 'dashboard',
          Inventory: 'inventory',
          Network: 'network',
          Received: 'received',
          Reservations: 'reservations',
        },
      },
      // Inventory (static `create` before `:inventoryId`)
      InventoryCreate: 'inventory/create',
      InventoryEdit: 'inventory/:inventoryId/edit',
      ManageShares: 'inventory/:inventoryId/shares',
      InventoryDetail: 'inventory/:inventoryId',
      // Network / vendors
      AddVendor: 'network/add',
      BulkUpload: 'network/bulk-upload',
      VendorDetail: 'vendor', // vendorId / manualVendorId ride as query params
      EditVendor: 'vendor/edit',
      // Received / misc (static `edit` suffix before the bare :shareId)
      ReceivedEdit: 'received/:shareId/edit',
      ReceivedDetail: 'received/:shareId',
      Notifications: 'notifications',
      Profile: 'profile',
      EditProfile: 'profile/edit',
      Settings: 'settings',
      Preferences: 'preferences',
      Legal: 'legal/:page',
      ShareLanding: 'share/:token', // public share link entry point (works signed out)
    },
  },
  // Clean public URLs for the legal pages: /privacy, /terms, /contact, /faq all
  // render the Legal screen with the matching page (works signed-out). Short
  // links (…/s/<code>) resolve to the same ShareLanding, passing the code; that
  // screen resolves it to a token via an anon RPC.
  getStateFromPath: (path, options) => {
    const seg = path.replace(/^\/+/, '').split(/[/?#]/)[0]?.toLowerCase();
    if (seg && (LEGAL_PATHS as readonly string[]).includes(seg)) {
      return { routes: [{ name: 'Legal', params: { page: seg as LegalPageParam } }] };
    }
    const m = path.match(/^\/?s\/([^/?#]+)/);
    if (m) {
      return { routes: [{ name: 'ShareLanding', params: { code: decodeURIComponent(m[1]) } }] };
    }
    return getStateFromPath(path, options);
  },
  // Reverse: render Legal as its clean /<page> URL instead of /legal/<page>.
  getPathFromState: (state, config) => {
    const route = activeLeafRoute(state as unknown as NavState);
    const page = route?.name === 'Legal' ? (route.params as { page?: string } | undefined)?.page : undefined;
    if (page) return `/${page}`;
    return getPathFromState(state, config);
  },
};

type LegalPageParam = RootStackParamList['Legal']['page'];
const LEGAL_PATHS = ['privacy', 'terms', 'contact', 'faq'] as const;

type NavState = {
  index?: number;
  routes: Array<{ name: string; params?: Record<string, unknown>; state?: NavState }>;
};

/** Walk a navigation state to its innermost active route (name + params). */
function activeLeafRoute(state: NavState): { name: string; params?: Record<string, unknown> } | undefined {
  let route = state.routes[state.index ?? state.routes.length - 1];
  while (route?.state) {
    const s = route.state;
    route = s.routes[s.index ?? s.routes.length - 1];
  }
  return route;
}

function LoadingView(): React.JSX.Element {
  return (
    <View style={styles.loading}>
      <BrandLoader mode="loop" size={150} />
    </View>
  );
}

/**
 * Route gating (spec §3.4):
 *   signedOut                       → auth stack
 *   signedIn + onboarded === false  → Onboarding only (no tabs reachable)
 *   signedIn + onboarded === true   → Main tabs + detail/modal stack
 * profile_complete is NOT gated here — the Share action checks it itself.
 */
export function RootNavigator(): React.JSX.Element {
  const status = useAuthStore((s) => s.status);
  const vendor = useAuthStore((s) => s.vendor);
  const initialize = useAuthStore((s) => s.initialize);
  const pendingShareToken = useAuthStore((s) => s.pendingShareToken);
  const setPendingShareToken = useAuthStore((s) => s.setPendingShareToken);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Wire push notification handlers once. A tapped push deep-links to the
  // relevant tab. No-op on web / Expo Go. Guarded so a native push-bridge
  // failure (notably iOS Firebase/APNs at startup) can never crash the app —
  // initPushHandlers already swallows internally, this is the outer backstop.
  useEffect(() => {
    try {
      initPushHandlers((data) => {
        const tab = pushTargetTab(data.type);
        if (tab && navigationRef.isReady()) {
          navigationRef.navigate('Main', { screen: tab });
        }
      });
    } catch (err) {
      console.warn('[push] handler wiring failed:', err);
    }
  }, []);

  // Once signed in + onboarded, resolve any share captured before auth. When a
  // user logs in FROM a shared inventory link, claim the share for them and land
  // them straight on that item's Received Inventory detail — not the dashboard,
  // and not back on the public preview where they'd have to claim manually. This
  // only affects the share-link login path (pendingShareToken is set solely by
  // the ShareLanding screen's Login/Signup buttons). Owners go to their own
  // listing instead; a claim failure falls back to the public preview.
  useEffect(() => {
    if (status === 'signedIn' && vendor?.onboarded && pendingShareToken && navigationRef.isReady()) {
      const token = pendingShareToken;
      setPendingShareToken(null);
      void (async () => {
        try {
          const res = await claimShare(token);
          navigationRef.reset({ index: 0, routes: [{ name: 'Main' }] });
          if (res.is_owner) {
            toast('This is your own listing.');
            navigationRef.navigate('InventoryDetail', { inventoryId: res.inventory_id });
          } else {
            navigationRef.navigate('ReceivedDetail', { shareId: res.share_id });
          }
        } catch {
          // Couldn't claim (revoked/invalid link, transient error) — show the
          // public preview rather than stranding the user on the dashboard.
          navigationRef.navigate('ShareLanding', { token });
        }
      })();
    }
  }, [status, vendor?.onboarded, pendingShareToken, setPendingShareToken]);

  // Still resolving session, or signed in but the vendor row hasn't loaded yet.
  if (status === 'loading' || (status === 'signedIn' && vendor === null)) {
    return <LoadingView />;
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking} fallback={<LoadingView />}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'signedOut' ? (
          <Stack.Group>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Otp" component={OtpScreen} />
            <Stack.Screen name="NewPassword" component={NewPasswordScreen} />
            <Stack.Screen name="ShareLanding" component={ShareLandingScreen} />
            {/* Public legal pages — reachable at /privacy, /terms, /contact, /faq without login. */}
            <Stack.Screen name="Legal" component={LegalScreen} />
          </Stack.Group>
        ) : vendor !== null && !vendor.onboarded ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="ShareLanding" component={ShareLandingScreen} />
            <Stack.Screen name="InventoryDetail" component={InventoryDetailScreen} />
            <Stack.Screen name="InventoryCreate" component={InventoryCreateScreen} />
            <Stack.Screen name="InventoryEdit" component={InventoryEditScreen} />
            <Stack.Screen name="ManageShares" component={ManageSharesScreen} />
            <Stack.Screen name="ReservationDetail" component={ReservationDetailScreen} />
            <Stack.Screen name="VendorDetail" component={VendorDetailScreen} />
            <Stack.Screen name="EditVendor" component={EditVendorScreen} />
            <Stack.Screen name="AddVendor" component={AddVendorScreen} />
            <Stack.Screen name="BulkUpload" component={BulkUploadScreen} />
            <Stack.Screen name="ReceivedDetail" component={ReceivedDetailScreen} />
            <Stack.Screen name="ReceivedEdit" component={ReceivedEditScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Preferences" component={PreferencesScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Legal" component={LegalScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50 },
});
