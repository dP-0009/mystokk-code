import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * Per-user "last time the Received tab was opened" — NATIVE ONLY (AsyncStorage).
 * The bottom-tab Received badge counts received items newer than this timestamp;
 * opening the tab calls markSeen() to clear it. First launch seeds the baseline
 * to "now" so pre-existing items don't all show up as new.
 */

const keyFor = (userId: string): string => `mystokk.receivedLastSeen:${userId}`;

interface ReceivedSeenState {
  lastSeen: number; // ms epoch
  hydratedFor: string | null;
  hydrate: (userId: string) => Promise<void>;
  markSeen: (userId: string) => Promise<void>;
}

export const useReceivedSeen = create<ReceivedSeenState>((set, get) => ({
  lastSeen: 0,
  hydratedFor: null,

  hydrate: async (userId) => {
    if (get().hydratedFor === userId) return;
    try {
      const stored = await AsyncStorage.getItem(keyFor(userId));
      if (stored) {
        set({ lastSeen: Number(stored), hydratedFor: userId });
      } else {
        const now = Date.now();
        await AsyncStorage.setItem(keyFor(userId), String(now));
        set({ lastSeen: now, hydratedFor: userId });
      }
    } catch {
      set({ lastSeen: Date.now(), hydratedFor: userId });
    }
  },

  markSeen: async (userId) => {
    const now = Date.now();
    set({ lastSeen: now });
    try {
      await AsyncStorage.setItem(keyFor(userId), String(now));
    } catch {
      /* ignore persistence errors */
    }
  },
}));
