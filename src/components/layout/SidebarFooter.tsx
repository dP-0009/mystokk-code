import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/tokens';

/** The four legal/support links pinned to the sidebar bottom. */
export type FooterLink = 'Privacy' | 'Terms' | 'Contact' | 'FAQ';

const FOOTER_LINKS: readonly FooterLink[] = ['Privacy', 'Terms', 'Contact', 'FAQ'];

type SidebarFooterProps = {
  /** Company / account display name (mirror shows "ECOZOE"). */
  name: string;
  /** Account email, shown muted + truncated under the name. */
  email: string;
  /** Tapping the user row (opens the account menu / profile). */
  onPressUser?: () => void;
  /** Tapping one of the Privacy | Terms | Contact | FAQ links. */
  onPressLink?: (link: FooterLink) => void;
};

/**
 * Sidebar bottom region (mirror `.sb-footer`): the signed-in user row plus the
 * Privacy | Terms | Contact | FAQ link strip.
 */
export function SidebarFooter({
  name,
  email,
  onPressUser,
  onPressLink,
}: SidebarFooterProps): React.JSX.Element {
  const initial = (name.trim()[0] ?? '?').toUpperCase();

  return (
    <View style={styles.footer}>
      <Pressable style={styles.user} onPress={onPressUser}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
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

      <View style={styles.links}>
        {FOOTER_LINKS.map((link) => (
          <Pressable key={link} onPress={() => onPressLink?.(link)}>
            <Text style={styles.linkText}>{link}</Text>
          </Pressable>
        ))}
      </View>
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
  },
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
