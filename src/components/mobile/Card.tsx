import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { GlassPanel } from './GlassPanel';
import { colors, radii, spacing, typography } from './theme';

/** Glass card — the workhorse container (.card, radius 30, padding 16). */
export function Card({
  children,
  onPress,
  style,
}: {
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const body = (
    <GlassPanel radius={radii.card} style={[styles.card, style]}>
      {children}
    </GlassPanel>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

/** Compact list row (.row, radius 26) — thumb + title/subtitle + trailing slot. */
export function Row({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  clamp = false,
  style,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** 2-line clamp for long product titles (prototype .t1.wrap2). */
  clamp?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const body = (
    <GlassPanel radius={radii.row} style={[styles.row, style]}>
      {leading}
      <View style={styles.mid}>
        <Text style={[typography.rowTitle as TextStyle, clamp && styles.clamp]} numberOfLines={clamp ? 2 : 1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.rowSub as TextStyle, styles.sub]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </GlassPanel>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressedRow}>
      {body}
    </Pressable>
  );
}

/** Uppercase section heading (.sect). */
export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }): React.JSX.Element {
  return <Text style={[typography.section as TextStyle, styles.sect, style]}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  mid: { flex: 1, minWidth: 0 },
  sub: { marginTop: 2.5 },
  clamp: { lineHeight: 20 },
  sect: { marginTop: 22, marginBottom: 10, marginHorizontal: 2 },
  pressed: { opacity: 0.95, transform: [{ scale: 0.99 }] },
  pressedRow: { transform: [{ scale: 0.985 }] },
});

export const cardDivider = { borderTopWidth: 1, borderTopColor: colors.line } as const;
