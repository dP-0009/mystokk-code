import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/tokens';

/** Avatar palette mirrors the UI mirror's `.va-*` swatches. */
const AVATAR_PALETTE = ['#2563EB', '#16A34A', '#EA580C', '#7C3AED', '#0891B2', '#DC2626', '#64748B'] as const;

function firstLetter(name: string | null | undefined): string {
  const c = name?.trim()?.[0];
  return c ? c.toUpperCase() : '?';
}

/** Stable color from the company name, so a vendor's letter circle stays consistent. */
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

interface VendorAvatarProps {
  /** Company name — drives the fallback initial + its color. */
  name: string | null | undefined;
  /** Company logo URL. When set, shown as a circular cover image. */
  logoUrl?: string | null;
  /** Diameter in px (default 34). */
  size?: number;
}

/**
 * Vendor avatar shared across the app (network table, share modal, view-vendor
 * popup, …). Shows the vendor's company logo as a circular cover image with a
 * 1.5px border when `logoUrl` is set; otherwise falls back to the colored
 * letter-initial circle.
 */
export function VendorAvatar({ name, logoUrl, size = 34 }: VendorAvatarProps): React.JSX.Element {
  const dim = { width: size, height: size, borderRadius: size / 2 };

  if (logoUrl) {
    return <Image source={{ uri: logoUrl }} style={[styles.logo, dim]} resizeMode="cover" />;
  }

  const seed = name?.trim() || '?';
  return (
    <View style={[styles.fallback, dim, { backgroundColor: avatarColor(seed) }]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.4) }]}>{firstLetter(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Circular logo — object-fit: cover via resizeMode, 1.5px #E2E8F0 border.
  logo: {
    borderWidth: 1.5,
    borderColor: colors.border, // #E2E8F0
    backgroundColor: colors.bgChip,
    flexShrink: 0,
  },
  fallback: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text: { color: colors.bgWhite, fontWeight: '700' },
});
