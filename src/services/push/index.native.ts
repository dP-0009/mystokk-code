import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { supabase } from '../supabase/client';
import type { PushNavigate } from './shared';

/**
 * Push notifications — native implementation (iOS/Android).
 *
 * Local display via Notifee, remote delivery via FCM. Requires a dev/prod build
 * (NOT Expo Go) with the Firebase config plugins + google-services files.
 * See PUSH_NOTIFICATIONS.md.
 */

const ANDROID_CHANNEL_ID = 'default';

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: ANDROID_CHANNEL_ID,
    name: 'General',
    importance: AndroidImportance.HIGH,
  });
}

/** Persist the device's FCM token on the current vendor's row. */
async function saveToken(token: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('vendors')
    .update({ push_token: token, push_platform: Platform.OS, push_token_updated_at: new Date().toISOString() })
    .eq('id', user.id);
}

/**
 * Request notification permission and register the FCM token. Call this AFTER
 * the user's first meaningful action (onboarding complete) — never on launch.
 */
export async function requestPushPermissionAndRegister(): Promise<void> {
  try {
    const settings = await messaging().requestPermission();
    const granted =
      settings === messaging.AuthorizationStatus.AUTHORIZED ||
      settings === messaging.AuthorizationStatus.PROVISIONAL;
    if (!granted) return;

    await ensureAndroidChannel();
    if (Platform.OS === 'ios') await messaging().registerDeviceForRemoteMessages();

    const token = await messaging().getToken();
    if (token) await saveToken(token);

    // Keep the stored token fresh if FCM rotates it.
    messaging().onTokenRefresh((t: string) => {
      void saveToken(t);
    });
  } catch {
    // permission denied / no Play services — silently skip
  }
}

/** Display a foreground push as a local Notifee notification. */
async function displayLocal(remoteMessage: {
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
}): Promise<void> {
  await ensureAndroidChannel();
  await notifee.displayNotification({
    title: remoteMessage.notification?.title ?? 'MyStokk',
    body: remoteMessage.notification?.body ?? '',
    data: remoteMessage.data ?? {},
    android: { channelId: ANDROID_CHANNEL_ID, pressAction: { id: 'default' } },
  });
}

/**
 * Wire foreground display + tap → deep-link. Call once after the navigator is
 * ready (RootNavigator). `navigate` receives the push data ({ type, related_id }).
 */
export function initPushHandlers(navigate: PushNavigate): void {
  type RemoteMessage = {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  } | null;

  // Foreground messages: show a local notification (FCM won't auto-display).
  messaging().onMessage(async (remoteMessage: RemoteMessage) => {
    await displayLocal(remoteMessage ?? {});
  });

  // Notifee press (foreground notification tapped).
  notifee.onForegroundEvent(
    ({ type, detail }: { type: number; detail: { notification?: { data?: Record<string, string> } } }) => {
      if (type === EventType.PRESS && detail.notification?.data) {
        navigate(detail.notification.data);
      }
    },
  );

  // App opened from background by tapping the FCM notification.
  messaging().onNotificationOpenedApp((remoteMessage: RemoteMessage) => {
    if (remoteMessage?.data) navigate(remoteMessage.data);
  });

  // App launched from a cold start by tapping the FCM notification.
  void messaging()
    .getInitialNotification()
    .then((remoteMessage: RemoteMessage) => {
      if (remoteMessage?.data) navigate(remoteMessage.data);
    });
}

/** Clear the stored token (e.g. on sign-out). */
export async function clearPushToken(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.from('vendors').update({ push_token: null }).eq('id', user.id);
    await messaging().deleteToken();
  } catch {
    // ignore
  }
}

export { pushTargetTab } from './shared';
export type { PushData, PushNavigate } from './shared';
