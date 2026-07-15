import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { useAuthStore } from '../stores/authStore';
import { usePushStore } from '../stores/pushStore';
import { toast } from '../stores/toast';
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

/** Settings (prototype SCREENS.settings): push toggle + Help & legal + Log out. */
export function SettingsScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const signOut = useAuthStore((s) => s.signOut);

  const pushEnabled = usePushStore((s) => s.enabled);
  const pushBusy = usePushStore((s) => s.busy);
  const hydratePush = usePushStore((s) => s.hydrate);
  const setPushEnabled = usePushStore((s) => s.setEnabled);

  React.useEffect(() => {
    void hydratePush();
  }, [hydratePush]);

  const togglePush = async (): Promise<void> => {
    if (pushBusy) return;
    const next = !pushEnabled;
    void Haptics.selectionAsync();
    try {
      await setPushEnabled(next);
      toast(next ? 'Push enabled' : 'Push disabled');
    } catch {
      toast('Could not update notifications.');
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
          <Toggle value={pushEnabled} onChange={() => void togglePush()} />
        </Card>

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
