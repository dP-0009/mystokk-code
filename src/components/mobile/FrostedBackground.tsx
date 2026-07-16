import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { radii } from './theme';

/**
 * Frosted white-glass background for every sheet/popover. A light BlurView with
 * a translucent white tint on top — frosted, but not so opaque it reads as a
 * plain white card. Shared so all popups look identical.
 *
 * NATIVE ONLY — reached solely from *.native forks; never in the web bundle.
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
    <View style={[style, { borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' }]}>
      <BlurView intensity={36} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tint: { backgroundColor: 'rgba(255,255,255,0.55)' },
});
