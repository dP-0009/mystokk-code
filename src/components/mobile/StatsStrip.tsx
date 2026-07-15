import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';

export interface Stat {
  label: string;
  value: string;
  /** Value color — prototype uses navy / green / amber / violet across the 4 cells. */
  color?: string;
  unit?: string;
}

/**
 * Bordered 4-cell stats strip (prototype item/received detail):
 * TOTAL QTY / AVAILABLE / RESERVED / SHARED WITH, each with a small caption,
 * a coloured value, and a unit line.
 */
export function StatsStrip({ stats }: { stats: Stat[] }): React.JSX.Element {
  return (
    <View style={styles.strip}>
      {stats.map((s, i) => (
        <View key={s.label} style={[styles.cell, i > 0 && styles.cellBorderLeft]}>
          <Text style={styles.caption}>{s.label}</Text>
          <Text style={[styles.value, s.color ? { color: s.color } : null]}>{s.value}</Text>
          {s.unit ? <Text style={styles.unit}>{s.unit}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    marginTop: 10,
    overflow: 'hidden',
  },
  cell: { flex: 1, paddingVertical: 11, paddingHorizontal: 6 },
  cellBorderLeft: { borderLeftWidth: 1, borderLeftColor: colors.line },
  caption: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4, color: colors.muted },
  value: { fontSize: 18, fontWeight: '800', color: colors.navy, marginTop: 3 },
  unit: { fontSize: 11, color: colors.muted, fontWeight: '600' },
});
