import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { BRAND } from '../../constants/brand';

/**
 * The "MyStokk" wordmark — `MySt` + `o` + `kk`, where the "o" is the brand
 * primary and the rest is the near-black wordmark color. Used everywhere the
 * wordmark appears with/near the logo.
 *
 * An optional `style` can override the base color (e.g. white on dark surfaces);
 * the "o" always stays the brand primary.
 */
export function BrandWordmark({
  size = 22,
  style,
}: {
  size?: number;
  style?: StyleProp<TextStyle>;
}): React.JSX.Element {
  return (
    <Text style={[styles.word, { fontSize: size }, style]} accessibilityLabel="MyStokk">
      MySt<Text style={styles.o}>o</Text>kk
    </Text>
  );
}

const styles = StyleSheet.create({
  word: { fontWeight: '800', letterSpacing: -0.5, color: BRAND.wordmark },
  o: { color: BRAND.primary },
});
