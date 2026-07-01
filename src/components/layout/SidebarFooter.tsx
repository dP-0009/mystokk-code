import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/tokens';

/** Retained for back-compat with existing imports; the link strip was removed. */
export type FooterLink = 'Privacy' | 'Terms' | 'Contact' | 'FAQ';

type SidebarFooterProps = {
  /** Company / account display name (mirror shows "ECOZOE"). */
  name: string;
  /** Account email, shown muted + truncated under the name. */
  email: string;
  /** Company logo URL for the avatar (falls back to the initial). */
  logoUrl?: string | null;
  /** Tapping the user row opens the account menu (Profile/Settings/…). */
  onPressUser?: () => void;
};

/**
 * Sidebar bottom region (`.sb-footer`): just the signed-in user row, which opens
 * the account menu. The legal/support links that used to sit here now live
 * inside that menu (Settings → tabs) instead.
 */
export function SidebarFooter({ name, email, logoUrl, onPressUser }: SidebarFooterProps): React.JSX.Element {
  const initial = (name.trim()[0] ?? '?').toUpperCase();

  return (
    <View style={styles.footer}>
      <Pressable style={styles.user} onPress={onPressUser}>
        <View style={styles.avatar}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.avatarImg} resizeMode="cover" />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {email}
          </Text>
        </View>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // `.sb-footer`
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // `.sb-user`
  user: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  // `.av`
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: colors.bgWhite, fontSize: 13, fontWeight: '700' },
  // `.ui`
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  userEmail: { fontSize: 11, color: colors.textMuted },
  chevron: { color: colors.textMuted, fontSize: 12 },
  // `.sb-links`
  links: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  linkText: { fontSize: 11, color: colors.textMuted },
});
