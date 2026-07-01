import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useUnreadCount } from '../../hooks/useUnreadCount';
import { colors } from '../../theme/tokens';
import { webOnly } from './web';

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
  /** Open the company-profile / account editor. */
  onProfile: () => void;
  /** Open the tabbed Settings page (preferences + policies). */
  onSettings: () => void;
  /** Navigate to /notifications. */
  onNotifications: () => void;
  /** Open the Contact page. */
  onContact: () => void;
  /** Sign out (redirects to /login via the navigator). */
  onLogout: () => void;
}

/**
 * Compact account menu shown when the sidebar user block is clicked (FIX 5).
 * Floats just above the sidebar footer: Settings, Notifications (with the live
 * unread count), and Log Out — it does NOT navigate to an edit-profile page.
 *
 * Deliberately NOT a react-native Modal: a transparent Modal overlay on web
 * could trap pointer events and leave the screen unclickable. Instead this
 * renders nothing when closed, and a real full-screen backdrop (inset 0) that
 * closes on press when open — so the screen can never get stuck.
 */
export function ProfileMenu({ visible, onClose, onProfile, onSettings, onNotifications, onContact, onLogout }: ProfileMenuProps): React.JSX.Element | null {
  const unread = useUnreadCount();

  // Escape closes (web).
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={styles.root}>
      {/* Full-screen backdrop — a click anywhere outside the card closes it. */}
      <Pressable style={styles.backdrop} onPress={onClose} testID="profile-menu-backdrop" />

      <View style={styles.card} testID="profile-menu">
        <MenuItem icon="person-outline" label="Profile" onPress={onProfile} testID="profile-menu-profile" />
        <MenuItem icon="settings-outline" label="Settings" onPress={onSettings} testID="profile-menu-settings" />
        <MenuItem
          icon="notifications-outline"
          label="Notifications"
          onPress={onNotifications}
          badge={unread}
          testID="profile-menu-notifications"
        />
        <MenuItem icon="mail-outline" label="Contact" onPress={onContact} testID="profile-menu-contact" />
        <View style={styles.divider} />
        <MenuItem icon="log-out-outline" label="Log Out" danger onPress={onLogout} testID="profile-menu-logout" />
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
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
  badge?: number;
  testID?: string;
}): React.JSX.Element {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      style={[styles.item, hover ? styles.itemHover : null]}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      testID={testID}
    >
      <Ionicons name={icon} size={18} color={danger ? colors.red : colors.textSecondary} />
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
  // Fills the viewport while open; nothing renders while closed.
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    ...webOnly({ position: 'fixed' }),
  },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },

  // Floats just above the sidebar user block (bottom-left), above the backdrop.
  card: {
    position: 'absolute',
    left: 16,
    bottom: 72,
    width: 240,
    zIndex: 1,
    backgroundColor: colors.bgWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    // 0 8px 32px rgba(0,0,0,0.18)
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 20,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginHorizontal: 6,
    borderRadius: 10,
    ...webOnly({ cursor: 'pointer' }),
  },
  itemHover: { backgroundColor: colors.bgChip }, // #F1F5F9
  itemText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  itemTextDanger: { color: colors.red },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.red, // #DC2626
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.bgWhite },
});
