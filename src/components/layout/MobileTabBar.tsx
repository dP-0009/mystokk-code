import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadows } from '../../theme/tokens';
import { PulsingDot } from '../shared/PulsingDot';
import type { SidebarNavId } from './SidebarNav';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Tab = { id: SidebarNavId; label: string; icon: IoniconName };

/** Five primary destinations; the sixth slot is the burger "Menu". */
const TABS: readonly Tab[] = [
  { id: 'dashboard', label: 'Home', icon: 'grid-outline' },
  { id: 'inventory', label: 'Inventory', icon: 'cube-outline' },
  { id: 'received', label: 'Received', icon: 'file-tray-outline' },
  { id: 'reservations', label: 'Reserve', icon: 'calendar-outline' },
  { id: 'network', label: 'Network', icon: 'people-outline' },
];

/**
 * Height of the bar itself, excluding the bottom safe-area inset:
 *   8 (wrap pad) + 1 + 8 (bar border+pad) + 22 (icon) + 3 (gap) + 12 (label)
 *   + 2×2 (item pad) + 8 (bar pad) + 1 + 10 (wrap pad)
 * Scrolling screens add this + `insets.bottom` to their bottom padding so the
 * floating bar never covers the last row of content. Keep in sync with `styles`.
 */
export const MOBILE_TAB_BAR_HEIGHT = 86;

type MobileTabBarProps = {
  /** Highlighted destination. */
  activeId?: SidebarNavId;
  /** Pulsing red dot on Reservation Hub when a reservation awaits a response. */
  reservationAttention?: boolean;
  onNavigate?: (id: SidebarNavId) => void;
};

/**
 * Floating bottom navigation for mobile viewports — replaces the desktop
 * sidebar. Five primary tabs; the account menu now opens from the profile button
 * in the top bar (not a burger here). Pinned to the bottom with side margins,
 * rounded corners and a soft shadow so it reads as a floating bar.
 */
export function MobileTabBar({
  activeId,
  reservationAttention,
  onNavigate,
}: MobileTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  // Keep the bar clear of the home indicator / browser chrome at the bottom.
  return (
    <View style={[styles.wrap, { paddingBottom: 10 + insets.bottom }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const active = tab.id === activeId;
          return (
            <Pressable key={tab.id} style={styles.item} onPress={() => onNavigate?.(tab.id)} accessibilityRole="button">
              <View style={styles.iconWrap}>
                <Ionicons name={tab.icon} size={21} color={active ? colors.accent : colors.textMuted} />
                {tab.id === 'reservations' && reservationAttention ? (
                  <View style={styles.dot}>
                    <PulsingDot size={8} />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, active ? styles.labelActive : null]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed band across the bottom; transparent so taps pass through the margins.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    // paddingBottom is applied inline (base 10 + safe-area inset).
    zIndex: 900,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgWhite,
    borderRadius: radius.lg, // 16
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
    ...shadows.dropdown,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  iconWrap: { width: 26, height: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -1, right: 0 },
  label: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  labelActive: { color: colors.accent, fontWeight: '700' },
});
