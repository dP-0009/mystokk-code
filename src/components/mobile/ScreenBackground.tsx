import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { screenGradient } from './theme';

/**
 * The refractive backdrop behind every native screen — the thing the glass
 * panels actually refract. Without it, GlassPanel has nothing to blur and the
 * whole system reads flat.
 *
 * Reproduces `.screen` + `.screen::before` from the prototype: a 168° linear
 * base, plus three soft radial glows (blue top-right, violet bottom-left, cyan
 * mid-right). The glows are SVG radial gradients rather than blurred circles so
 * they stay smooth at any screen size and cost one draw call.
 */
export function ScreenBackground({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={[...screenGradient.colors]}
        locations={[...screenGradient.locations]}
        start={screenGradient.start}
        end={screenGradient.end}
        style={StyleSheet.absoluteFill}
      />

      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {/* blue — top right */}
          <RadialGradient id="glowBlue" cx="92%" cy="-6%" r="55%">
            <Stop offset="0" stopColor="#69AFFF" stopOpacity={0.42} />
            <Stop offset="0.7" stopColor="#69AFFF" stopOpacity={0} />
          </RadialGradient>
          {/* violet — bottom left */}
          <RadialGradient id="glowViolet" cx="-12%" cy="108%" r="52%">
            <Stop offset="0" stopColor="#AC96FF" stopOpacity={0.34} />
            <Stop offset="0.7" stopColor="#AC96FF" stopOpacity={0} />
          </RadialGradient>
          {/* cyan — mid right */}
          <RadialGradient id="glowCyan" cx="114%" cy="56%" r="45%">
            <Stop offset="0" stopColor="#69DCFF" stopOpacity={0.26} />
            <Stop offset="0.72" stopColor="#69DCFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowBlue)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowViolet)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowCyan)" />
      </Svg>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
