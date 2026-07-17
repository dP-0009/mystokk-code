import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { BrandWordmark } from './BrandWordmark';

const LOGO = require('../../../assets/branding/mystokk-logo.png');

interface BrandMarkProps {
  /** Diameter of the rounded icon tile. */
  size?: number;
  /** Wordmark font size. Omit to hide the "MyStokk" text (icon only). */
  labelSize?: number | null;
  /** Render the wordmark in white (for use on dark surfaces). */
  light?: boolean;
}

/**
 * The MyStokk brand lockup — the logo mark (assets/mystokk-logo.png) plus the
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
      <Image source={LOGO} style={{ width: size, height: size }} resizeMode="contain" />
      {labelSize ? <BrandWordmark size={labelSize} style={light ? styles.light : undefined} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  light: { color: '#FFFFFF' },
});
