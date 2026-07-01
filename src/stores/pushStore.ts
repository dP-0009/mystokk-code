import { Platform } from 'react-native';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearPushToken, requestPushPermissionAndRegister } from '../services/push';

/**
 * Push-notification preference — a single persisted on/off flag shared by every
 * screen that shows a push toggle (the Profile "Enable Notifications" button and
 * the Settings → Notification Preferences switch). Because both read/write this
 * store, enabling from one place immediately reflects in the other, and the
 * choice survives reloads.
 *
 * Native: enabling also registers the FCM token; disabling clears it. Web has no
 * push (the service calls are no-ops), so the flag is purely the saved preference.
 */

const KEY = 'mystokk.pushEnabled';
const isWeb = Platform.OS === 'web';

async function readStored(): Promise<boolean> {
  try {
    if (isWeb) {
      return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
    }
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

async function writeStored(value: boolean): Promise<void> {
  try {
    if (isWeb) {
      if (typeof localStorage === 'undefined') return;
      if (value) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
      return;
    }
    if (value) await AsyncStorage.setItem(KEY, '1');
    else await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore persistence errors */
  }
}

interface PushState {
  enabled: boolean;
  hydrated: boolean;
  busy: boolean;
  /** Load the saved preference once (idempotent). */
  hydrate: () => Promise<void>;
  /** Turn push on/off: register/clear the token (native) and persist the flag. */
  setEnabled: (next: boolean) => Promise<void>;
}

export const usePushStore = create<PushState>((set, get) => ({
  enabled: false,
  hydrated: false,
  busy: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const enabled = await readStored();
    set({ enabled, hydrated: true });
  },

  setEnabled: async (next) => {
    if (get().busy || next === get().enabled) return;
    set({ busy: true });
    try {
      if (next) await requestPushPermissionAndRegister();
      else await clearPushToken();
      await writeStored(next);
      set({ enabled: next });
    } finally {
      set({ busy: false });
    }
  },
}));
