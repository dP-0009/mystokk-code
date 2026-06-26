import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../../theme/tokens';
import type { ColorValue } from '../../theme/tokens';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type StatCardProps = {
  /** Small uppercase label (mirror `.sl`). */
  label: string;
  /** Big headline number (mirror `.sv`). */
  value: number | string;
  /** Muted sub-line (mirror `.ss`). */
  sub: string;
  icon: IoniconName;
  /** Icon glyph color. */
  iconColor: ColorValue;
  /** Tinted square behind the icon (mirror `.si-*`). */
  iconBg: ColorValue;
  onPress?: () => void;
};

/**
 * Dashboard stat card (mirror `.sc`): label / number / sub on the left, a
 * tinted icon square on the right. White surface, bordered, radius 16.
 */
export function StatCard({
  label,
  value,
  sub,
  icon,
  iconColor,
  iconBg,
  onPress,
}: StatCardProps): React.JSX.Element {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.textCol}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <View style={[styles.icon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // `.sc`
  card: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 20,
  },
  textCol: { flexShrink: 1 },
  // `.sl`
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  // `.sv`
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
    marginBottom: 2,
  },
  // `.ss`
  sub: { fontSize: 12, color: colors.textMuted },
  // `.si`
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
