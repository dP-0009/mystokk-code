import React from 'react';
import { Image, StyleSheet, Text, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { gradients, type GradientName } from './theme';

/** "White Wood Pine" → "WW"; matches the prototype's mono(). */
export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Deterministic gradient per name, so a vendor keeps the same colour everywhere. */
export function gradientFor(name: string): GradientName {
  const names = Object.keys(gradients) as GradientName[];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return names[hash % names.length] as GradientName;
}

/**
 * Round company/person avatar (.avatar). If `logoUrl` is set, the ACTUAL
 * uploaded logo fills the circle; otherwise it falls back to the initials
 * monogram on a deterministic gradient.
 */
export function Avatar({
  name,
  size = 45,
  gradient,
  logoUrl,
  style,
}: {
  name: string;
  size?: number;
  gradient?: GradientName;
  /** Uploaded company logo URL — shown instead of the monogram when present. */
  logoUrl?: string | null;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        resizeMode="cover"
        style={[{ width: size, height: size, borderRadius: size / 2 }, style as StyleProp<ImageStyle>]}
      />
    );
  }
  return (
    <LinearGradient
      colors={[...gradients[gradient ?? gradientFor(name)]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.center, { width: size, height: size, borderRadius: size / 2 }, style]}
    >
      <Text style={[styles.text, { fontSize: size * 0.31 }]}>{initials(name)}</Text>
    </LinearGradient>
  );
}

/** Rounded-square gradient thumbnail (.thumb) — inventory items. */
export function Thumb({
  name,
  size = 52,
  radius,
  gradient,
  style,
}: {
  name: string;
  size?: number;
  radius?: number;
  gradient?: GradientName;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <LinearGradient
      colors={[...gradients[gradient ?? gradientFor(name)]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.center, { width: size, height: size, borderRadius: radius ?? size * 0.25 }, style]}
    >
      <Text style={[styles.text, { fontSize: size * 0.29 }]}>{initials(name)}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.3 },
});
