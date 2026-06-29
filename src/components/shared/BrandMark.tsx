import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../../theme/tokens';

interface BrandMarkProps {
  /** Diameter of the rounded icon tile. */
  size?: number;
  /** Wordmark font size. Omit to hide the "MyStokk" text (icon only). */
  labelSize?: number | null;
  /** Render the wordmark in white (for use on dark surfaces). */
  light?: boolean;
}

/**
 * The MyStokk brand lockup — a blue rounded tile with a cube glyph plus the
 * wordmark. Mirrors the sidebar logo so auth + landing surfaces read as the
 * same product.
 */
export function BrandMark({
  size = 36,
  labelSize = 18,
  light = false,
}: BrandMarkProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={[styles.tile, { width: size, height: size, borderRadius: radius.md }]}>
        <Ionicons name="cube" size={size * 0.5} color={colors.bgWhite} />
      </View>
      {labelSize ? (
        <Text style={[styles.word, { fontSize: labelSize, color: light ? '#FFFFFF' : colors.textPrimary }]}>
          MyStokk
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  word: { fontWeight: '800', letterSpacing: -0.3 },
});
