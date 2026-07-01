import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { webOnly } from '../components/layout/web';
import { LegalContent, type LegalPage } from '../components/shared/LegalContent';
import { requestPushPermissionAndRegister } from '../services/push';
import { colors, radius } from '../theme/tokens';
import { toast } from '../stores/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Preferences'>;

type TabId = 'notifications' | LegalPage;

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'notifications', label: 'Notification Preferences' },
  { id: 'faq', label: 'FAQ' },
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'terms', label: 'Terms' },
];

/**
 * The "Settings" page reached from the account menu: a tabbed container for
 * notification preferences plus the FAQ / Privacy / Terms policy pages (which
 * reuse the shared <LegalContent/>). The company-profile / account editor lives
 * on the separate "Profile" entry (the existing Settings screen).
 */
export function PreferencesScreen({ navigation }: Props): React.JSX.Element {
  const [tab, setTab] = useState<TabId>('notifications');

  return (
    <MainLayout>
      <PageHeader
        title="Settings"
        subtitle="Notification preferences and policies"
        leading={<BackLink onPress={() => navigation.goBack()} />}
      />
      <PageBody>
        <View style={styles.wrap}>
          <View style={styles.tabs}>
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTab(t.id)}
                  style={[styles.tab, active ? styles.tabActive : null, webOnly({ cursor: 'pointer' })]}
                >
                  <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {tab === 'notifications' ? <NotificationPreferences /> : <LegalContent page={tab} />}
        </View>
      </PageBody>
    </MainLayout>
  );
}

/** Notification-preferences tab — a push on/off toggle (mobile only). */
function NotificationPreferences(): React.JSX.Element {
  const [push, setPush] = useState(false);

  const onToggle = async (next: boolean): Promise<void> => {
    if (!next) {
      setPush(false);
      return;
    }
    if (Platform.OS === 'web') {
      toast('Push notifications are available in the MyStokk mobile app.');
      return;
    }
    try {
      await requestPushPermissionAndRegister();
      setPush(true);
      toast('Notifications enabled.');
    } catch {
      toast('Could not enable notifications.');
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.prefRow}>
        <View style={styles.prefInfo}>
          <Text style={styles.prefLabel}>Push notifications</Text>
          <Text style={styles.prefSub}>
            Get alerts for new shares, reservations, and forwards on your device.
          </Text>
        </View>
        <Switch
          value={push}
          onValueChange={(v) => void onToggle(v)}
          trackColor={{ true: colors.accent, false: colors.border }}
        />
      </View>
    </View>
  );
}

function BackLink({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[styles.backLink, webOnly({ cursor: 'pointer' })]}>
      <Text style={styles.backText}>← Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  backLink: { marginBottom: 8 },
  backText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tab: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgWhite,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.bgWhite },

  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 20,
  },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  prefInfo: { flex: 1, minWidth: 0 },
  prefLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  prefSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 19 },
});
