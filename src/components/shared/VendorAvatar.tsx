import React, { useEffect, useState } from 'react';
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

/** Free/personal email providers — these have no "company" logo, so fall back
 *  to the letter circle instead of showing the provider's icon. */
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'zoho.com', 'yandex.com',
]);

/**
 * Company logo URL derived from a manual contact's email domain, or null when
 * not derivable (no email / personal provider). Clearbit's logo API was sunset,
 * so we use Google's favicon service, which reliably returns a company's
 * logo/favicon for any real domain.
 */
function logoFromEmail(email: string | null | undefined): string | null {
  const domain = email?.trim().split('@')[1]?.toLowerCase();
  if (!domain || !domain.includes('.') || FREE_EMAIL_DOMAINS.has(domain)) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

interface VendorAvatarProps {
  /** Company name — drives the fallback initial + its color. */
  name: string | null | undefined;
  /** Company logo URL. When set, shown as a circular cover image. */
  logoUrl?: string | null;
  /**
   * Contact email. Used for MANUAL contacts (no MyStokk account) to look up a
   * company logo from the email domain via Clearbit when `logoUrl` is absent.
   */
  email?: string | null;
  /** Diameter in px (default 34). */
  size?: number;
}

/**
 * Vendor avatar shared across the app (network table, share modal, view-vendor
 * popup, …). Resolution order:
 *   1. `logoUrl` (the vendor's uploaded company logo), if set.
 *   2. A logo derived from `email`'s company domain (manual contacts).
 *   3. Colored letter-initial circle fallback.
 * If a remote logo fails to load (broken URL / domain miss), it falls back to
 * the next option via the image `onError` handler — never a broken-image icon.
 */
export function VendorAvatar({ name, logoUrl, email, size = 34 }: VendorAvatarProps): React.JSX.Element {
  const dim = { width: size, height: size, borderRadius: size / 2 };

  // Candidate remote image: explicit uploaded logo first, else logo-by-email-domain.
  const remoteUri = logoUrl || logoFromEmail(email);

  // Track load failure so a broken remote logo degrades to the letter circle.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [remoteUri]);

  if (remoteUri && !failed) {
    return (
      <Image
        source={{ uri: remoteUri }}
        style={[styles.logo, dim]}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
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
