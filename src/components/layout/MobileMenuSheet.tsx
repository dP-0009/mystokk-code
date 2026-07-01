import React, { useEffect } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, shadows } from '../../theme/tokens';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import { webOnly } from './web';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface MobileMenuSheetProps {
  visible: boolean;
  /** Display name + email for the account header. */
  name: string;
  email: string;
  /** Company logo URL for the account avatar (falls back to the initial). */
  logoUrl?: string | null;
  onClose: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onNotifications: () => void;
  onContact: () => void;
  onLogout: () => void;
}

/**
 * Bottom sheet opened by the mobile top-bar profile button: account header +
 * Profile / Settings / Notifications / Contact, and Log Out — the same menu as
 * the desktop ProfileMenu.
 *
 * Like ProfileMenu, this is deliberately NOT a react-native Modal — a
 * transparent Modal overlay on web can trap pointer events. It renders nothing
 * when closed and a real full-screen backdrop + bottom card when open.
 */
export function MobileMenuSheet({
  visible,
  name,
  email,
  logoUrl,
  onClose,
  onProfile,
  onSettings,
  onNotifications,
  onContact,
  onLogout,
}: MobileMenuSheetProps): React.JSX.Element | null {
  const unread = useUnreadCount();

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const initial = (name.trim()[0] ?? '?').toUpperCase();

  return (
    <View style={styles.root}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="mobile-menu-backdrop" />

      <View style={styles.sheet} testID="mobile-menu">
        <View style={styles.handle} />

        {/* Account header */}
        <View style={styles.account}>
          <View style={styles.avatar}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.avatarImg} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <MenuItem icon="person-outline" label="Profile" onPress={onProfile} />
        <MenuItem icon="settings-outline" label="Settings" onPress={onSettings} />
        <MenuItem icon="notifications-outline" label="Notifications" onPress={onNotifications} badge={unread} />
        <MenuItem icon="mail-outline" label="Contact" onPress={onContact} />

        <View style={styles.divider} />

        <MenuItem icon="log-out-outline" label="Log Out" danger onPress={onLogout} />
      </View>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
  badge,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  badge?: number;
}): React.JSX.Element {
  return (
    <Pressable style={styles.item} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={danger ? colors.red : colors.textSecondary} />
      <Text style={[styles.itemText, danger ? styles.itemTextDanger : null]}>{label}</Text>
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'flex-end',
    ...webOnly({ position: 'fixed' }),
  },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.45)' },

  sheet: {
    backgroundColor: colors.bgWhite,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 28,
    ...shadows.dropdown,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginVertical: 8 },

  account: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: colors.bgWhite, fontSize: 16, fontWeight: '700' },
  accountInfo: { flex: 1, minWidth: 0 },
  accountName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  accountEmail: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6, marginHorizontal: 12 },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    ...webOnly({ cursor: 'pointer' }),
  },
  itemText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  itemTextDanger: { color: colors.red },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.bgWhite },
});
