import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useUnreadCount } from '../../hooks/useUnreadCount';
import { colors } from '../../theme/tokens';
import { webOnly } from './web';

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
  /** Navigate to /settings. */
  onSettings: () => void;
  /** Navigate to /notifications. */
  onNotifications: () => void;
  /** Sign out (redirects to /login via the navigator). */
  onLogout: () => void;
}

/**
 * Compact account menu shown when the sidebar user block is clicked (FIX 5).
 * Floats just above the sidebar footer: Settings, Notifications (with the live
 * unread count), and Log Out — it does NOT navigate to an edit-profile page.
 * Clicking outside (the transparent backdrop) closes it.
 */
export function ProfileMenu({ visible, onClose, onSettings, onNotifications, onLogout }: ProfileMenuProps): React.JSX.Element {
  const unread = useUnreadCount();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()} testID="profile-menu">
          <MenuItem icon="settings-outline" label="Settings" onPress={onSettings} testID="profile-menu-settings" />
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            onPress={onNotifications}
            badge={unread}
            testID="profile-menu-notifications"
          />
          <View style={styles.divider} />
          <MenuItem icon="log-out-outline" label="Log Out" danger onPress={onLogout} testID="profile-menu-logout" />
        </Pressable>
      </Pressable>
    </Modal>
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
  overlay: { flex: 1, backgroundColor: 'transparent', ...webOnly({ position: 'fixed' }) },
  // Floats just above the sidebar user block (bottom-left).
  card: {
    position: 'absolute',
    left: 16,
    bottom: 72,
    width: 240,
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
