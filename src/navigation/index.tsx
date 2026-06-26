import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
  type LinkingOptions,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/tokens';
import { initPushHandlers, pushTargetTab } from '../services/push';
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
import { ProfileScreen } from '../screens/ProfileScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

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
  ShareLanding: { token: string }; // public share landing (deep link)
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
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Notifications: undefined;
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
    process.env.EXPO_PUBLIC_APP_URL ?? 'https://mystokk.vercel.app',
    'https://mystokk.app',
    'https://app.mystokk.com',
  ],
  config: {
    screens: {
      Otp: 'verify',
      ShareLanding: 'share/:token', // public share link entry point (works signed out)
      InventoryDetail: 'inventory/:inventoryId',
    },
  },
};

function LoadingView(): React.JSX.Element {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.emerald} size="large" />
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
  // relevant tab. No-op on web / Expo Go.
  useEffect(() => {
    initPushHandlers((data) => {
      const tab = pushTargetTab(data.type);
      if (tab && navigationRef.isReady()) {
        navigationRef.navigate('Main', { screen: tab });
      }
    });
  }, []);

  // Once signed in + onboarded, jump to any share captured before auth so the
  // user can claim it (the ShareLanding screen claims on the action button).
  useEffect(() => {
    if (status === 'signedIn' && vendor?.onboarded && pendingShareToken && navigationRef.isReady()) {
      const token = pendingShareToken;
      setPendingShareToken(null);
      navigationRef.navigate('ShareLanding', { token });
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
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50 },
});
