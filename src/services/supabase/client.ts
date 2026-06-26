import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client for MyStokk.
 *
 * Token storage (spec §7.1 — never plaintext in AsyncStorage):
 *   The Supabase session can exceed Android SecureStore's ~2KB limit, so we use
 *   Supabase's official Expo pattern. Each value is AES-256-CTR encrypted with a
 *   per-key random key; the KEY lives in the hardware-backed secure store
 *   (iOS Keychain / Android Keystore) via expo-secure-store, and only the
 *   CIPHERTEXT is kept in AsyncStorage. The ciphertext is useless without the
 *   Keystore-held key. Works in Expo Go and production builds, with no size cap.
 *
 *   On web (dev preview only) SecureStore is unavailable, so we fall back to
 *   localStorage — web is not a production target for this mobile app.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Add them to .env and restart Expo.',
  );
}

interface SecureStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const isWeb = Platform.OS === 'web';

class LargeSecureStore implements SecureStorageAdapter {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this.decrypt(key, encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    // We exchange the OAuth ?code= ourselves: on web in authStore.initialize()
    // (deterministic + surfaces errors), on native in signInWithGoogle(). Letting
    // supabase-js also auto-detect would race us and double-consume the code.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

/**
 * Supabase recommends pausing token auto-refresh while the app is backgrounded
 * and resuming it on foreground, so sessions stay fresh without wasting work.
 */
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
