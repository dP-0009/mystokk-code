import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassPanel } from './GlassPanel';
import { colors } from './theme';

/**
 * Single-select pill (.chip) — used for "Link expires: 24h / 7 days / 30 days /
 * Never". Selected state is a solid navy fill, not glass.
 */
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}): React.JSX.Element {
  const text = (
    <Text style={[styles.text, selected ? styles.textOn : styles.textOff]}>{label}</Text>
  );

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {selected ? (
        <View style={[styles.chip, styles.chipOn]}>{text}</View>
      ) : (
        <GlassPanel effect="clear" radius={18} style={styles.chip}>
          {text}
        </GlassPanel>
      )}
    </Pressable>
  );
}

/** Horizontal scroller for a Chip group. */
export function ChipRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Multi-select category chip (.catchip) — wraps rather than scrolls, used for
 * the Categories pickers on onboarding / profile / add-vendor.
 */
export function CategoryChip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <GlassPanel
        effect="clear"
        radius={17}
        fill={selected ? 'rgba(232,241,255,0.9)' : undefined}
        style={[styles.catChip, selected && styles.catChipOn]}
      >
        <Text style={[styles.catText, selected && styles.catTextOn]}>{label}</Text>
      </GlassPanel>
    </Pressable>
  );
}

export function CategoryChipGroup({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.catGroup}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    height: 35,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: 'rgba(15,43,84,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: colors.navy,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  chipRow: { gap: 8, paddingVertical: 2, paddingBottom: 12 },
  text: { fontSize: 13, fontWeight: '700' },
  textOff: { color: colors.muted },
  textOn: { color: '#FFFFFF' },
  catChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catChipOn: { borderColor: 'rgba(46,124,246,0.55)' },
  catText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  catTextOn: { color: colors.blueDark },
  catGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pressed: { transform: [{ scale: 0.95 }] },
});
