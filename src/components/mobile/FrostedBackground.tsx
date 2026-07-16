import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { radii } from './theme';

/**
 * THE frosted surface — a single source of truth for every sheet and popover.
 *
 * Blur intensity, the white overlay, and the hairline border colour live here
 * and nowhere else, so all glass surfaces are pixel-identical. NATIVE ONLY —
 * reached solely from *.native forks; never in the web bundle.
 */
export const FROST_BLUR = 36;
export const FROST_BORDER = 'rgba(255,255,255,0.6)';
// Opaque backing (alpha 1) that sits BEHIND the blur. It occludes the app in the
// panel region, so the BlurView samples this uniform surface instead of the live
// app behind the transparent Modal — that is what stops background content from
// bleeding through sparse sheets. Frost is preserved: blur + tint still sit on top.
const FROST_BASE = '#E9F0FA';
const FROST_TINT = 'rgba(255,255,255,0.85)';

/**
 * The frosted fill: an opaque base, then a BlurView, then a translucent white
 * overlay — all absolute-fill layers. Drop it in as the first child of any
 * clipped, rounded container to give it the shared glass look. Layout-neutral
 * (position absolute), so it never affects sibling flow.
 */
export function FrostedFill(): React.JSX.Element {
  return (
    <>
      <View style={[StyleSheet.absoluteFill, styles.base]} />
      <BlurView intensity={FROST_BLUR} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
    </>
  );
}

/**
 * Frosted white-glass background for popovers — the fill wrapped in a fully
 * rounded, bordered, clipping container.
 */
export function FrostedBackground({
  style,
  radius = radii.sheet,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  radius?: number;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={[style, { borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: FROST_BORDER }]}>
      <FrostedFill />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: FROST_BASE },
  tint: { backgroundColor: FROST_TINT },
});
