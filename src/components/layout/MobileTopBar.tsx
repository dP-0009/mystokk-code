import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/tokens';
import { NotificationBell } from './NotificationBell';
import { webOnly } from './web';

type MobileTopBarProps = {
  /** Signed-in company / account name, shown bold next to the logo. */
  company: string;
  /** Company logo URL for the profile button (falls back to the initial). */
  logoUrl?: string | null;
  /** Tapping the profile circle opens the account menu sheet. */
  onProfilePress?: () => void;
};

/**
 * Mobile top app bar — the MyStokk logo + company name on the left, and the
 * notification bell plus a round company-logo profile button on the right (the
 * profile button opens the account menu). Replaces the sidebar on narrow views.
 */
export function MobileTopBar({ company, logoUrl, onProfilePress }: MobileTopBarProps): React.JSX.Element {
  const initial = (company.trim()[0] ?? '?').toUpperCase();
  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <View style={styles.brandText}>
          <Text style={styles.kicker}>MYSTOKK</Text>
          <Text style={styles.company} numberOfLines={1}>
            {company}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <NotificationBell inline />
        <Pressable
          style={[styles.profile, webOnly({ cursor: 'pointer' })]}
          onPress={onProfilePress}
          accessibilityRole="button"
          accessibilityLabel="Account menu"
          testID="mobile-profile-button"
        >
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.profileImg} resizeMode="cover" />
          ) : (
            <Text style={styles.profileText}>{initial}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: colors.bgWhite,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    // Lift the whole bar (and its notification dropdown) above the scrolling
    // content below — otherwise the popup, being an earlier sibling, paints
    // under the main content and stays invisible.
    zIndex: 1000,
    ...webOnly({ position: 'relative' }),
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
  brandText: { flexShrink: 1, minWidth: 0 },
  kicker: { fontSize: 10, fontWeight: '700', color: colors.accent, letterSpacing: 0.6 },
  company: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  profile: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileImg: { width: '100%', height: '100%' },
  profileText: { color: colors.bgWhite, fontSize: 14, fontWeight: '700' },
});
