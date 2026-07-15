import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { GlassPanel } from './GlassPanel';
import { Icon, type IconName } from './Icon';
import { colors, glass, layout, radii } from './theme';

export interface TabItem {
  key: string;
  label: string;
  icon: IconName;
  /**
   * Proportional slot width (CLAUDE.md rule 9a). Slots are NOT equal — a long
   * label like "Reservation Hub" needs more room than "Home", and equal slots
   * would clip it.
   */
  flex: number;
  badge?: number;
}

/** Bar height + the gap under it. Screens pad their scroll content by this. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return layout.tabBarHeight + TAB_BAR_GAP + insets.bottom + 12;
}

/** Gap between the bar and the home indicator (rule 9e). */
const TAB_BAR_GAP = 10;

/**
 * The floating glass tab bar — four proportional tabs (rule 9a).
 *
 * Anchored off the safe-area inset rather than a fixed bottom, so it always
 * clears the iOS home indicator (rule 9e). The active highlight pill is inset
 * 4px from its own tab's edges (left/right, width:auto in the prototype) rather
 * than a fixed width, so it tracks each tab's proportional slot.
 */
export function TabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (key: string) => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <GlassPanel
      effect="regular"
      radius={radii.tabBar}
      fill={glass.fillTabBar}
      style={[styles.bar, { bottom: insets.bottom + TAB_BAR_GAP }]}
    >
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(t.key);
            }}
            style={({ pressed }) => [styles.tab, { flex: t.flex }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            {/* Highlight pill — inset 4px inside THIS tab, so it adapts to the slot. */}
            {on ? <View style={styles.highlight} /> : null}

            <View style={styles.iconWrap}>
              <Icon name={t.icon} size={24} color={on ? colors.blue : colors.text} />
              {t.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t.badge > 99 ? '99+' : t.badge}</Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.label, on ? styles.labelOn : styles.labelOff]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 10,
    right: 10,
    // `bottom` is applied inline from the safe-area inset.
    zIndex: 50,
    height: layout.tabBarHeight,
    flexDirection: 'row',
    paddingTop: 11,
    paddingHorizontal: 4,
  },
  tab: { alignItems: 'center', gap: 3, paddingTop: 5, minWidth: 0 },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    height: 58,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  iconWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -11,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
  // 9.5px, single line, tight tracking — never wraps (rule 9a).
  label: { fontSize: 9.5, fontWeight: '700', letterSpacing: -0.15 },
  labelOff: { color: colors.text },
  labelOn: { color: colors.blue, fontWeight: '800' },
  pressed: { opacity: 0.55 },
});
