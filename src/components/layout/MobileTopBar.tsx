import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../../theme/tokens';
import { NotificationBell } from './NotificationBell';

type MobileTopBarProps = {
  /** Signed-in company / account name, shown bold next to the logo. */
  company: string;
};

/**
 * Mobile top app bar — the MyStokk logo + company name on the left and the
 * notification bell on the right. Replaces the sidebar logo/identity on narrow
 * viewports.
 */
export function MobileTopBar({ company }: MobileTopBarProps): React.JSX.Element {
  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Ionicons name="cube" size={16} color={colors.bgWhite} />
        </View>
        <View style={styles.brandText}>
          <Text style={styles.kicker}>MYSTOKK</Text>
          <Text style={styles.company} numberOfLines={1}>
            {company}
          </Text>
        </View>
      </View>
      <NotificationBell inline />
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
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandText: { flexShrink: 1, minWidth: 0 },
  kicker: { fontSize: 10, fontWeight: '700', color: colors.accent, letterSpacing: 0.6 },
  company: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
});
