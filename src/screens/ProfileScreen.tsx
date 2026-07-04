import React from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { getMyVendor, getProfileStats } from '../services/supabase/vendor';
import { useAuthStore } from '../stores/authStore';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { clearPushToken } from '../services/push';
import { confirmAction } from '../utils/confirm';
import { LoadingState } from '../components/shared/StateView';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

function initials(name: string | null): string {
  if (!name) return 'MS';
  const parts = name.trim().split(/\s+/);
  return (parts.slice(0, 2).map((p) => p[0] ?? '').join('') || 'MS').toUpperCase();
}

function titleCase(s: string | null): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const signOut = useAuthStore((s) => s.signOut);
  const unread = useUnreadCount();

  const { data: vendor, isLoading, refetch } = useQuery({ queryKey: ['myVendor'], queryFn: getMyVendor, staleTime: 30_000 });
  const { data: stats } = useQuery({ queryKey: ['profileStats'], queryFn: getProfileStats, staleTime: 30_000 });

  useFocusEffect(
    React.useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const onSignOut = (): void => {
    confirmAction({
      title: 'Sign out?',
      message: 'You can sign back in anytime.',
      confirmLabel: 'Sign Out',
      destructive: true,
      onConfirm: () => {
        void clearPushToken();
        void signOut();
      },
    });
  };

  const MENU: ReadonlyArray<{ icon: string; bg: string; label: string; sub?: string; onPress: () => void; danger?: boolean }> = [
    { icon: '🏢', bg: colors.emeraldBg, label: 'Company Profile', sub: 'Edit name, industry, location, logo', onPress: () => navigation.navigate('EditProfile') },
    { icon: '🔔', bg: colors.blueBg, label: 'Notifications', sub: unread > 0 ? `${unread} unread` : 'All caught up', onPress: () => navigation.navigate('Notifications') },
    { icon: '⚙️', bg: colors.slate100, label: 'Settings', sub: 'Password, account preferences', onPress: () => navigation.navigate('Settings') },
    { icon: '❓', bg: colors.amberBg, label: 'Help & FAQ', onPress: () => Alert.alert('Help & FAQ', 'Reach us at support@mystokk.app.') },
    { icon: '🔒', bg: colors.slate100, label: 'Privacy Policy', onPress: () => Alert.alert('Privacy Policy', 'Your stock is shared only with vendors you choose.') },
    { icon: '🚪', bg: colors.redBg, label: 'Sign Out', onPress: onSignOut, danger: true },
  ];

  return (
    <View style={styles.fill}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.side}>
            <Text style={styles.headerIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Pressable onPress={() => navigation.navigate('EditProfile')} hitSlop={10} style={styles.sideRight}>
            <Text style={styles.headerIcon}>✏️</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {isLoading || !vendor ? (
        <LoadingState />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              {vendor.logo_url ? (
                <Image source={{ uri: vendor.logo_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{initials(vendor.company_name)}</Text>
              )}
            </View>
            <Text style={styles.company}>{vendor.company_name ?? 'Your Company'}</Text>
            {vendor.contact_person ? (
              <Text style={styles.contact}>
                {vendor.contact_person}
                {vendor.role ? ` · ${titleCase(vendor.role)}` : ''}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              {[vendor.city, vendor.country].filter(Boolean).join(', ')}
              {vendor.industry ? ` · ${vendor.industry}` : ''}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats?.inventory ?? 0}</Text>
              <Text style={styles.statLabel}>Inventory Items</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats?.network ?? 0}</Text>
              <Text style={styles.statLabel}>Network</Text>
            </View>
          </View>

          <View style={styles.menu}>
            {MENU.map((m, i) => (
              <Pressable
                key={m.label}
                style={[styles.menuItem, i < MENU.length - 1 ? styles.menuDivider : null]}
                onPress={m.onPress}
              >
                <View style={[styles.menuIcon, { backgroundColor: m.bg }]}>
                  <Text style={styles.menuIconText}>{m.icon}</Text>
                </View>
                <View style={styles.menuInfo}>
                  <Text style={[styles.menuLabel, m.danger ? styles.menuDanger : null]}>{m.label}</Text>
                  {m.sub ? <Text style={styles.menuSub}>{m.sub}</Text> : null}
                </View>
                {!m.danger ? <Text style={styles.chevron}>›</Text> : null}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  headerSafe: { backgroundColor: colors.navy },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  side: { width: 34, alignItems: 'flex-start' },
  sideRight: { width: 34, alignItems: 'flex-end' },
  headerIcon: { color: '#FFFFFF', fontSize: 22, fontWeight: '600' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  identity: { backgroundColor: '#FFFFFF', alignItems: 'center', paddingVertical: 26, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  avatar: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 26 },
  company: { fontSize: 18, fontWeight: '800', color: colors.slate900, textAlign: 'center' },
  contact: { fontSize: 13, color: colors.slate500, marginTop: 2 },
  meta: { fontSize: 12, color: colors.slate400, marginTop: 6 },

  statsRow: { flexDirection: 'row', gap: 12, padding: 16 },
  statBox: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: colors.slate100 },
  statVal: { fontSize: 24, fontWeight: '800', color: colors.navy },
  statLabel: { fontSize: 12, color: colors.slate500, marginTop: 2 },

  menu: { backgroundColor: '#FFFFFF', borderRadius: 14, marginHorizontal: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.slate100, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  menuIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuIconText: { fontSize: 17 },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  menuDanger: { color: colors.red },
  menuSub: { fontSize: 12, color: colors.slate500, marginTop: 1 },
  chevron: { fontSize: 20, color: colors.slate400 },
});
