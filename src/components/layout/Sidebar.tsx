import React, { type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../../theme/tokens';
import { webOnly } from './web';

type SidebarProps = {
  /** Nav items, rendered in the scrollable middle region. */
  children?: ReactNode;
  /** Bottom region — typically a `<SidebarFooter>`. */
  footer?: ReactNode;
};

/**
 * Left navigation rail (mirror `.sidebar`).
 *
 * 240px wide, white surface with a right border. Three stacked regions: the
 * logo header, a scrollable nav list (flex:1), and a pinned footer. On web it
 * sticks to the top and runs the full viewport height; on native it stretches
 * to fill the flex row.
 */
export function Sidebar({ children, footer }: SidebarProps): React.JSX.Element {
  return (
    <View style={styles.sidebar}>
      <View style={styles.logo}>
        <View style={styles.logoIcon}>
          <Ionicons name="cube" size={18} color={colors.bgWhite} />
        </View>
        <Text style={styles.logoText}>MyStokk</Text>
      </View>

      <ScrollView style={styles.nav} contentContainerStyle={styles.navContent}>
        {children}
      </ScrollView>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: spacing.sidebarWidth,
    flexShrink: 0,
    flexDirection: 'column',
    backgroundColor: colors.bgWhite,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    ...webOnly({ position: 'sticky', top: 0, height: '100vh' }),
  },
  // `.sb-logo`
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  // `.sb-nav`
  nav: { flex: 1 },
  navContent: { paddingVertical: 8 },
});
