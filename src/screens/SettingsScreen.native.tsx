import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toast';
// Native push fork (explicit path): keeps the web push shim untouched — these
// grant-aware helpers exist only in the native implementation.
import {
  clearPushToken,
  getNotificationPermission,
  requestPushPermissionAndRegister,
} from '../services/push/index.native';
import {
  Card,
  Icon,
  NavBar,
  ScreenBackground,
  SectionLabel,
  Toggle,
  colors,
  layout,
  spacing,
  type IconName,
} from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

type LegalPage = 'faq' | 'privacy' | 'terms' | 'contact';
const LEGAL_ROWS: ReadonlyArray<{ icon: IconName; label: string; page: LegalPage }> = [
  { icon: 'help', label: 'FAQ', page: 'faq' },
  { icon: 'shield', label: 'Privacy Policy', page: 'privacy' },
  { icon: 'doc', label: 'Terms of Service', page: 'terms' },
  { icon: 'mail', label: 'Contact support', page: 'contact' },
];

/** Per-category alert preferences — persisted locally (no DB columns added). */
type CatKey = 'newShares' | 'reservationRequests' | 'reservationUpdates' | 'counterOffers';
const CATEGORIES: ReadonlyArray<{ key: CatKey; label: string; icon: IconName }> = [
  { key: 'newShares', label: 'New shares received', icon: 'inbox' },
  { key: 'reservationRequests', label: 'Reservation requests', icon: 'hand' },
  { key: 'reservationUpdates', label: 'Reservation updates', icon: 'check' },
  { key: 'counterOffers', label: 'Counter offers', icon: 'share' },
];
type CatPrefs = Record<CatKey, boolean>;
const DEFAULT_CATS: CatPrefs = {
  newShares: true,
  reservationRequests: true,
  reservationUpdates: true,
  counterOffers: true,
};

const MASTER_KEY = 'mystokk.pushEnabled'; // same key the shared push flow uses
const CATS_KEY = 'mystokk.notifyCategories';

/** Settings (prototype SCREENS.settings): push + per-category alerts + legal + log out. */
export function SettingsScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const signOut = useAuthStore((s) => s.signOut);

  const [master, setMaster] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false); // OS-level denied → show "Open settings"
  const [cats, setCats] = React.useState<CatPrefs>(DEFAULT_CATS);

  const persistMaster = React.useCallback(async (value: boolean): Promise<void> => {
    try {
      if (value) await AsyncStorage.setItem(MASTER_KEY, '1');
      else await AsyncStorage.removeItem(MASTER_KEY);
    } catch {
      /* ignore persistence errors */
    }
  }, []);

  // Hydrate saved prefs + reconcile with the real OS permission on mount.
  React.useEffect(() => {
    let active = true;
    void (async () => {
      const [storedMaster, storedCats, perm] = await Promise.all([
        AsyncStorage.getItem(MASTER_KEY),
        AsyncStorage.getItem(CATS_KEY),
        getNotificationPermission(),
      ]);
      if (!active) return;
      if (storedCats) {
        try {
          setCats({ ...DEFAULT_CATS, ...(JSON.parse(storedCats) as Partial<CatPrefs>) });
        } catch {
          /* keep defaults */
        }
      }
      if (perm === 'denied') {
        // Permission revoked/denied at OS level — push can't work; reflect that.
        setMaster(false);
        setBlocked(true);
        if (storedMaster === '1') void persistMaster(false);
      } else {
        setMaster(storedMaster === '1');
        setBlocked(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [persistMaster]);

  const toggleMaster = (): void => {
    if (busy) return;
    const next = !master;
    void Haptics.selectionAsync();
    if (next) {
      // Enabling: bring the sub-toggles back — restore last saved states, or
      // default all ON if none were on (e.g. they were all turned off earlier).
      const restored = CATEGORIES.some((c) => cats[c.key]) ? cats : DEFAULT_CATS;
      setCats(restored);
      void AsyncStorage.setItem(CATS_KEY, JSON.stringify(restored));
      setBlocked(false);
    }
    // Optimistic: flip instantly, do permission/registration in the background.
    setMaster(next);
    void persistMaster(next);
    setBusy(true);
    void (async () => {
      try {
        if (next) {
          const granted = await requestPushPermissionAndRegister();
          if (!granted) {
            setMaster(false); // revert
            setBlocked(true);
            await persistMaster(false);
            toast('Enable notifications in system settings to turn on push.');
            return;
          }
        } else {
          await clearPushToken();
        }
      } catch {
        setMaster(!next); // revert on unexpected failure
        await persistMaster(!next);
        toast('Could not update notifications.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const toggleCat = (key: CatKey): void => {
    if (!master) return;
    void Haptics.selectionAsync();
    const nextCats = { ...cats, [key]: !cats[key] };
    setCats(nextCats);
    void AsyncStorage.setItem(CATS_KEY, JSON.stringify(nextCats));
    // Turning off every category turns off the master push toggle too.
    if (CATEGORIES.every((c) => !nextCats[c.key])) {
      setMaster(false);
      void persistMaster(false);
      void clearPushToken();
      toast('Push notifications turned off.');
    }
  };

  return (
    <ScreenBackground>
      <NavBar title="Settings" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SectionLabel>Notifications</SectionLabel>
        <Card style={styles.pushCard}>
          <View style={styles.pushIcon}>
            <Icon name="bell" size={19} color={colors.blueDark} />
          </View>
          <View style={styles.pushText}>
            <Text style={styles.pushTitle}>Push notifications</Text>
            <Text style={styles.pushSub}>Alerts for shares & reservations</Text>
          </View>
          <Toggle value={master} onChange={toggleMaster} />
        </Card>

        {blocked ? (
          <Pressable
            onPress={() => void Linking.openSettings()}
            style={({ pressed }) => [styles.blockedNote, pressed && styles.pressed]}
          >
            <Icon name="shield" size={16} color={colors.amber} />
            <Text style={styles.blockedText}>
              Notifications are turned off for MyStokk.{' '}
              <Text style={styles.blockedLink}>Open settings</Text>
            </Text>
          </Pressable>
        ) : null}

        <SectionLabel>Notify me about</SectionLabel>
        <View pointerEvents={master ? 'auto' : 'none'} style={!master ? styles.disabled : undefined}>
          <Card style={styles.rowsCard}>
            {CATEGORIES.map((c, i) => (
              <View key={c.key} style={[styles.row, i < CATEGORIES.length - 1 && styles.rowBorder]}>
                <View style={styles.rowIcon}>
                  <Icon name={c.icon} size={18} color={colors.blueDark} />
                </View>
                <Text style={styles.rowLabel}>{c.label}</Text>
                <Toggle value={master && cats[c.key]} onChange={() => toggleCat(c.key)} />
              </View>
            ))}
          </Card>
        </View>

        <SectionLabel>Help & legal</SectionLabel>
        <Card style={styles.rowsCard}>
          {LEGAL_ROWS.map((r, i) => (
            <Pressable
              key={r.page}
              onPress={() => navigation.navigate('Legal', { page: r.page })}
              style={({ pressed }) => [styles.row, i < LEGAL_ROWS.length - 1 && styles.rowBorder, pressed && styles.pressed]}
            >
              <View style={styles.rowIcon}>
                <Icon name={r.icon} size={19} color={colors.blueDark} />
              </View>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Icon name="chev" size={17} color={colors.chev} />
            </Pressable>
          ))}
        </Card>

        <Card style={styles.rowsCard}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void signOut();
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={[styles.rowIcon, styles.rowIconDanger]}>
              <Icon name="off" size={19} color={colors.red} />
            </View>
            <Text style={[styles.rowLabel, styles.rowLabelDanger]}>Log out</Text>
          </Pressable>
        </Card>

        <Text style={styles.version}>MyStokk v1.0 · Ever Global Trading LLC</Text>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter },

  pushCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 },
  pushIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.ice, alignItems: 'center', justifyContent: 'center' },
  pushText: { flex: 1, minWidth: 0 },
  pushTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  pushSub: { fontSize: 12.5, color: colors.muted, fontWeight: '600', marginTop: 2 },

  blockedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,205,110,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(240,224,188,0.9)',
  },
  blockedText: { flex: 1, fontSize: 12.5, color: '#6B5518', fontWeight: '600', lineHeight: 18 },
  blockedLink: { color: colors.blueDark, fontWeight: '800' },

  disabled: { opacity: 0.4 },

  rowsCard: { padding: 0, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.ice, alignItems: 'center', justifyContent: 'center' },
  rowIconDanger: { backgroundColor: colors.redBg },
  rowLabel: { flex: 1, fontSize: 15.5, fontWeight: '700', color: colors.navy },
  rowLabelDanger: { color: colors.red },

  version: { textAlign: 'center', fontSize: 12, color: '#A6B3C9', marginTop: 16 },
  pressed: { opacity: 0.55 },
});
