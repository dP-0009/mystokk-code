import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../../theme/tokens';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type NavItemProps = {
  icon: IoniconName;
  label: string;
  /** Highlights the row (mirror `.ni.active`). */
  active?: boolean;
  /** Optional blue count pill (mirror `.nb`). Hidden when undefined or 0. */
  badge?: number;
  onPress?: () => void;
};

/**
 * A single sidebar nav row (mirror `.ni`).
 * Resting: muted label. Hover: page-tint bg + primary text. Active: blue tint
 * bg + accent text. An optional right-aligned blue badge pill shows a count.
 */
export function NavItem({
  icon,
  label,
  active = false,
  badge,
  onPress,
}: NavItemProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false);

  const fg = active ? colors.accent : hovered ? colors.textPrimary : colors.textSecondary;
  const showBadge = typeof badge === 'number' && badge > 0;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.item,
        active ? styles.itemActive : hovered ? styles.itemHover : null,
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={15} color={fg} />
      </View>
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
      {showBadge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // `.ni`
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  itemHover: { backgroundColor: colors.bgPage }, // `.ni:hover`
  itemActive: { backgroundColor: colors.accentLight }, // `.ni.active`
  // `.ni-icon`
  iconWrap: { width: 18, alignItems: 'center' },
  label: { flex: 1, fontSize: 13, fontWeight: '500' },
  // `.nb`
  badge: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 1,
    paddingHorizontal: 7,
  },
  badgeText: { color: colors.bgWhite, fontSize: 11, fontWeight: '600' },
});
