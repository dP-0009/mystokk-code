import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandLogo } from './BrandLogo';
import { BrandWordmark } from './BrandWordmark';

interface BrandMarkProps {
  /** Diameter of the rounded icon tile. */
  size?: number;
  /** Wordmark font size. Omit to hide the "MyStokk" text (icon only). */
  labelSize?: number | null;
  /** Render the wordmark in white (for use on dark surfaces). */
  light?: boolean;
}

/**
 * The MyStokk brand lockup — the drawn logo mark (BrandLogo) plus the
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
      <BrandLogo size={size} />
      {labelSize ? <BrandWordmark size={labelSize} style={light ? styles.light : undefined} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  light: { color: '#FFFFFF' },
});
