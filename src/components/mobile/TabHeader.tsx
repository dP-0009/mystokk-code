import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../../navigation';
import { getDashboardData } from '../../services/supabase/dashboard';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import { useAuthStore } from '../../stores/authStore';

import { Avatar } from './Avatar';
import { NavButton } from './NavBar';
import { Popover, SheetAction } from './Sheet';
import { colors, spacing } from './theme';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * Identity for the header. Reuses the dashboard query (same ['dashboard'] cache
 * key, 60s staleTime) rather than adding a fetch — the auth store only carries
 * flags, not the company name.
 */
export function useIdentity(): { company: string; firstName: string } {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboardData, staleTime: 60_000 });
  const company = data?.vendor.companyName ?? '';
  const contact = data?.vendor.contactPerson ?? '';
  return { company, firstName: contact.split(' ')[0] ?? '' };
}

/**
 * Shared header for every tab screen (prototype `cluster()`): title/subtitle on
 * the left, bell + avatar on the right. The bell carries a red dot while any
 * notification is unread; the avatar opens the ProfilePopover.
 *
 * `eyebrow` renders the small uppercase company line above the title (Home).
 */
export function TabHeader({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const navigation = useNavigation<Nav>();
  const { company } = useIdentity();
  const unread = useUnreadCount();

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.left}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.cluster}>
          <NavButton icon="bell" badge={unread > 0} onPress={() => navigation.navigate('Notifications')} />
          <Pressable onPress={() => setMenuOpen(true)} accessibilityRole="button">
            <Avatar name={company || 'MyStokk'} size={42} gradient="nav" />
          </Pressable>
        </View>
      </View>

      <ProfilePopover open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

/**
 * Avatar menu (prototype `openMenu()`): Business profile, Settings,
 * Notifications, Contact, Log out. Scales in from the top-right.
 */
export function ProfilePopover({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const signOut = useAuthStore((s) => s.signOut);
  const { company, firstName } = useIdentity();

  const go = (fn: () => void): void => {
    onClose();
    fn();
  };

  return (
    <Popover open={open} onClose={onClose}>
      <View style={styles.popHead}>
        <Avatar name={company || 'MyStokk'} size={42} gradient="nav" />
        <View style={styles.popHeadText}>
          <Text style={styles.popName} numberOfLines={1}>
            {company || 'MyStokk'}
          </Text>
          {firstName ? (
            <Text style={styles.popSub} numberOfLines={1}>
              {firstName}
            </Text>
          ) : null}
        </View>
      </View>

      <SheetAction icon="user" label="Business profile" onPress={() => go(() => navigation.navigate('Profile'))} />
      <SheetAction icon="gear" label="Settings" onPress={() => go(() => navigation.navigate('Settings'))} />
      <SheetAction icon="bell" label="Notifications" onPress={() => go(() => navigation.navigate('Notifications'))} />
      <SheetAction
        icon="mail"
        label="Contact"
        onPress={() => go(() => navigation.navigate('Legal', { page: 'contact' }))}
      />
      <SheetAction icon="off" label="Log out" danger last onPress={() => go(() => void signOut())} />
    </Popover>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: spacing.gutter,
    paddingBottom: 4,
  },
  left: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 12.5, color: colors.muted, fontWeight: '700', letterSpacing: 0.4 },
  title: { fontSize: 23, fontWeight: '800', color: colors.navy, letterSpacing: -0.5 },
  subtitle: { fontSize: 14.5, color: colors.muted, marginTop: 3 },
  cluster: { flexDirection: 'row', alignItems: 'center', gap: 9 },

  popHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 4,
  },
  popHeadText: { flex: 1, minWidth: 0 },
  popName: { fontSize: 15, fontWeight: '800', color: colors.navy },
  popSub: { fontSize: 11.5, color: colors.muted, fontWeight: '600' },
});
