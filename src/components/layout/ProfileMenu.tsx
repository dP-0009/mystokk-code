import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { getMyVendor } from '../../services/supabase/vendor';
import { VendorAvatar } from '../shared/VendorAvatar';
import { colors } from '../../theme/tokens';
import { webOnly } from './web';

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
  /** Navigate to /settings. */
  onSettings: () => void;
  /** Sign out (redirects to /login via the navigator). */
  onLogout: () => void;
  /** Shown until the vendor profile query resolves. */
  fallbackName?: string;
  fallbackEmail?: string;
}

/**
 * Small popup shown when the sidebar user block is clicked (FIX 5). Floats just
 * above the sidebar footer with the user's avatar/identity and a short menu.
 * Clicking the dark backdrop (outside the card) closes it.
 */
export function ProfileMenu({
  visible,
  onClose,
  onSettings,
  onLogout,
  fallbackName,
  fallbackEmail,
}: ProfileMenuProps): React.JSX.Element {
  const { data } = useQuery({
    queryKey: ['myVendor'],
    queryFn: getMyVendor,
    enabled: visible,
    staleTime: 30_000,
  });

  const name = data?.company_name ?? fallbackName ?? 'MyStokk';
  const email = data?.email ?? fallbackEmail ?? '';
  const logoUrl = data?.logo_url ?? null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()} testID="profile-menu">
          <View style={styles.identity}>
            <VendorAvatar name={name} logoUrl={logoUrl} size={56} />
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {email}
            </Text>
          </View>

          <View style={styles.divider} />

          <MenuItem icon="settings-outline" label="Profile Settings" onPress={onSettings} testID="profile-menu-settings" />
          <MenuItem icon="log-out-outline" label="Logout" danger onPress={onLogout} testID="profile-menu-logout" />
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
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
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
      <Ionicons name={icon} size={17} color={danger ? colors.red : colors.textSecondary} />
      <Text style={[styles.itemText, danger ? styles.itemTextDanger : null]}>{label}</Text>
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
    width: 280,
    backgroundColor: colors.bgWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 18,
    paddingBottom: 8,
    // 0 8px 32px rgba(0,0,0,0.18)
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 20,
  },
  identity: { alignItems: 'center', paddingHorizontal: 16, gap: 6 },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  email: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 10,
    ...webOnly({ cursor: 'pointer' }),
  },
  itemHover: { backgroundColor: colors.bgChip }, // #F1F5F9
  itemText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  itemTextDanger: { color: colors.red },
});
