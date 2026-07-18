import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BRAND } from '../../constants/brand';

/**
 * Lockup geometry — the SINGLE source of truth for the MyStokk mark, shared by
 * BrandLogo (static) and BrandLoader (animated) so the two can never drift.
 *
 * Everything is expressed in a 150×150 design stage and scaled by `size / 150`.
 * Three navy blocks sit in an L (top-left, bottom-left, bottom-right); the
 * primary block sits top-right, displaced up and to the right by TR_RELEASE.
 * This reproduces assets/branding/mystokk-logo.png exactly.
 */
export const LOCKUP = {
  STAGE: 150,
  BLOCK: 40, // 26.7% of the stage
  RADIUS: 12, // 30% of a block
  SLOTS: {
    tl: { left: 30, top: 44 },
    bl: { left: 30, top: 94 },
    br: { left: 80, top: 94 },
    tr: { left: 80, top: 44 },
  },
  /** Top-right block's final displacement: +6.0% / −6.7% of the stage. */
  TR_RELEASE: { x: 9, y: -10 },
} as const;

/**
 * BrandLogo — the MyStokk mark drawn with plain Views, no image asset.
 *
 * Renders on the FIRST frame with no decode/network latency, which is why every
 * in-app surface uses this instead of <Image source={mystokk-logo.png}>. The PNG
 * is now reserved for surfaces the OS or a crawler renders for us: the app icon,
 * the native splash, the favicon, and store/social meta images.
 *
 * Geometrically identical to BrandLoader's end state at the same `size`.
 */
export function BrandLogo({ size = 112 }: { size?: number }): React.JSX.Element {
  const k = size / LOCKUP.STAGE;
  const { SLOTS, TR_RELEASE, BLOCK, RADIUS } = LOCKUP;

  const block = (left: number, top: number): object => ({
    position: 'absolute',
    width: BLOCK * k,
    height: BLOCK * k,
    borderRadius: RADIUS * k,
    left: left * k,
    top: top * k,
  });

  return (
    <View style={{ width: size, height: size }} accessibilityLabel="MyStokk">
      <View style={[block(SLOTS.tl.left, SLOTS.tl.top), styles.navy]} />
      <View style={[block(SLOTS.bl.left, SLOTS.bl.top), styles.navy]} />
      <View style={[block(SLOTS.br.left, SLOTS.br.top), styles.navy]} />
      <View
        style={[
          block(SLOTS.tr.left + TR_RELEASE.x, SLOTS.tr.top + TR_RELEASE.y),
          styles.primary,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  navy: { backgroundColor: BRAND.navy },
  primary: { backgroundColor: BRAND.primary },
});
