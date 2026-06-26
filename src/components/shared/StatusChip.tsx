import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/tokens';

interface ChipStyle {
  label: string;
  bg: string;
  fg: string;
}

// Inventory + reservation statuses, mapped to the documented chip colors.
const MAP: Record<string, ChipStyle> = {
  active: { label: 'Active', bg: colors.emeraldBg, fg: colors.emerald },
  partially_reserved: { label: 'Partially Reserved', bg: colors.amberBg, fg: colors.amber },
  partially_allocated: { label: 'Partially Allocated', bg: colors.amberBg, fg: colors.amber },
  sold_out: { label: 'Sold Out', bg: colors.slate100, fg: colors.slate500 },
  archived: { label: 'Archived', bg: colors.slate100, fg: colors.slate500 },
  // reservation statuses
  pending: { label: 'Pending', bg: colors.amberBg, fg: colors.amber },
  negotiating: { label: 'Negotiating', bg: colors.blueBg, fg: colors.blue },
  confirmed: { label: 'Confirmed', bg: colors.emeraldBg, fg: colors.emerald },
  rejected: { label: 'Rejected', bg: colors.redBg, fg: colors.red },
  cancelled: { label: 'Cancelled', bg: colors.slate100, fg: colors.slate500 },
  passed: { label: 'Passed', bg: colors.slate100, fg: colors.slate500 },
};

export function StatusChip({ status }: { status: string }): React.JSX.Element {
  const s = MAP[status] ?? { label: status, bg: colors.slate100, fg: colors.slate500 };
  return (
    <View style={[styles.chip, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '700' },
});
