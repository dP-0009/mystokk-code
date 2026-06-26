import type { PushNavigate } from './shared';

/**
 * Push notifications — default / web implementation (NO-OP).
 *
 * @notifee/react-native and @react-native-firebase/messaging are native-only;
 * they don't exist in Expo Go or on web. The real implementation lives in
 * `index.native.ts` (Metro picks it for iOS/Android). This file keeps the web
 * bundle clean and lets every screen import from '../services/push' safely.
 */

export type { PushData, PushNavigate } from './shared';
export { pushTargetTab } from './shared';

/** Ask for permission + register the FCM token. No-op on web/Expo Go. */
export async function requestPushPermissionAndRegister(): Promise<void> {
  /* native only */
}

/** Wire foreground display + notification-tap deep-linking. No-op on web/Expo Go. */
export function initPushHandlers(_navigate: PushNavigate): void {
  /* native only */
}

/** Clear the stored token on sign-out. No-op on web/Expo Go. */
export async function clearPushToken(): Promise<void> {
  /* native only */
}
