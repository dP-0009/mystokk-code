import React, { useRef, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../../theme/tokens';
import { webOnly } from '../layout/web';
import { useIsMobile } from '../../hooks/useIsMobile';

/**
 * Shared building blocks for the mobile inventory / received-item detail pages:
 * a swipeable hero gallery, label/value info rows, a 4-up stat grid, a section
 * card, and file rows (with a coloured type badge or an "Open" link). Kept here
 * so My Inventory and Received Inventory render an identical layout.
 */

export const HERO_HEIGHT = 240;
/** Taller hero on wide screens so a contained (uncropped) photo reads at a usable size. */
const HERO_HEIGHT_WEB = 460;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Full-width hero gallery. Index-controlled (not native scroll-paging): shows
 * ONE fully-contained photo and navigates via prev/next arrows, tappable dots,
 * or swipe. This avoids react-native-web's flaky `pagingEnabled` snap (images
 * landed mid-scroll, looking cropped) and unreliable momentum-scroll events
 * (the dots never advanced). Every photo shows whole — portrait or landscape.
 */
export function HeroCarousel({
  photos,
  onShare,
  onOpen,
}: {
  photos: string[];
  onShare?: () => void;
  onOpen: (index: number) => void;
}): React.JSX.Element {
  const [idx, setIdx] = useState(0);
  const isMobile = useIsMobile();
  const h = isMobile ? HERO_HEIGHT : HERO_HEIGHT_WEB;
  const count = photos.length;
  const cur = Math.min(idx, count - 1);
  const go = (dir: 1 | -1): void => setIdx((c) => (count === 0 ? 0 : (c + dir + count) % count));

  // Swipe left/right on touch devices (web uses the arrows / dots).
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 50) go(-1);
        else if (g.dx < -50) go(1);
      },
    }),
  ).current;

  return (
    <View>
      <View style={[styles.hero, { height: h }]} {...pan.panHandlers}>
        <Pressable
          style={styles.heroPage}
          onPress={() => onOpen(cur)}
          accessibilityLabel={`View photo ${cur + 1}`}
        >
          {/* contain so the FULL photo shows (never cropped) — letterboxed on the light frame. */}
          <Image source={{ uri: photos[cur] }} style={styles.heroImg} resizeMode="contain" />
        </Pressable>

        {count > 1 ? (
          <>
            <Pressable style={[styles.heroNav, styles.heroNavLeft, webOnly({ cursor: 'pointer' })]} onPress={() => go(-1)} accessibilityLabel="Previous photo">
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable style={[styles.heroNav, styles.heroNavRight, webOnly({ cursor: 'pointer' })]} onPress={() => go(1)} accessibilityLabel="Next photo">
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </Pressable>
          </>
        ) : null}
        {onShare ? (
          <Pressable style={[styles.heroBtn, styles.heroBtnRight, webOnly({ cursor: 'pointer' })]} onPress={onShare}>
            <Ionicons name="share-social-outline" size={17} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <View style={styles.heroBadge}>
          <Ionicons name="images-outline" size={13} color="#FFFFFF" />
          <Text style={styles.heroBadgeText}>
            {count} photo{count === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {count > 1 ? (
        <View style={styles.dots}>
          {photos.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => setIdx(i)}
              style={[styles.dot, i === cur ? styles.dotActive : null, webOnly({ cursor: 'pointer' })]}
              accessibilityLabel={`Go to photo ${i + 1}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A label/value info row inside the title card. */
export function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export interface StatSpec {
  label: string;
  value: number;
  sub: string;
  color?: string;
  onPress?: () => void;
}

/** A bordered 4-up stat grid. */
export function StatGrid({ stats }: { stats: StatSpec[] }): React.JSX.Element {
  return (
    <View style={styles.statGrid}>
      {stats.map((s, i) => {
        const Wrap = s.onPress ? Pressable : View;
        return (
          <Wrap
            key={s.label}
            onPress={s.onPress}
            style={[
              styles.stat,
              i < stats.length - 1 ? styles.statBorder : null,
              s.onPress ? webOnly({ cursor: 'pointer' }) : null,
            ]}
          >
            <Text style={styles.statLabel} numberOfLines={2}>
              {s.label}
            </Text>
            <Text style={[styles.statValue, s.color ? { color: s.color } : null]} numberOfLines={1}>
              {s.value.toLocaleString()}
            </Text>
            <Text style={styles.statSub}>{s.sub}</Text>
          </Wrap>
        );
      })}
    </View>
  );
}

/** A section card with an icon + title header. */
export function DetailCard({
  icon,
  title,
  children,
}: {
  icon: IoniconName;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Ionicons name={icon} size={16} color={colors.textPrimary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const FILE_BADGE: Record<string, { color: string; bg: string }> = {
  csv: { color: colors.green, bg: colors.greenLight },
  xls: { color: colors.green, bg: colors.greenLight },
  xlsx: { color: colors.green, bg: colors.greenLight },
  pdf: { color: colors.red, bg: colors.redLight },
  doc: { color: colors.accent, bg: colors.accentLight },
  docx: { color: colors.accent, bg: colors.accentLight },
};
function fileExt(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : '';
}

/** A file row with a coloured type badge ("CSV"/"PDF") or an "Open ↗" link. */
export function FileRow({
  name,
  onPress,
  variant = 'badge',
}: {
  name: string;
  onPress: () => void;
  variant?: 'badge' | 'open';
}): React.JSX.Element {
  const ext = fileExt(name);
  const c = FILE_BADGE[ext] ?? { color: colors.textSecondary, bg: colors.bgChip };
  return (
    <Pressable style={[styles.fileRow, webOnly({ cursor: 'pointer' })]} onPress={onPress} accessibilityLabel={`Open ${name}`}>
      <View style={[styles.fileIcon, { backgroundColor: c.bg }]}>
        <Ionicons name="document-text-outline" size={18} color={c.color} />
      </View>
      <Text style={styles.fileName} numberOfLines={1}>
        {name}
      </Text>
      {variant === 'open' ? (
        <Text style={styles.fileOpen}>Open ↗</Text>
      ) : ext ? (
        <Text style={[styles.fileBadge, { color: c.color }]}>{ext.toUpperCase()}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: HERO_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgChip, // light frame so a contained photo never blends in
    marginBottom: 10,
  },
  heroPage: { width: '100%', height: '100%' },
  heroImg: { width: '100%', height: '100%' },
  heroBtn: {
    position: 'absolute',
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnRight: { right: 12 },
  // Prev/next arrows — vertically centred on the frame edges.
  heroNav: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNavLeft: { left: 12 },
  heroNavRight: { right: 12 },
  heroBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15,23,42,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.borderDark },
  dotActive: { width: 18, backgroundColor: colors.accent },

  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  infoLabel: { fontSize: 14, color: colors.textSecondary },
  infoValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },

  statGrid: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: 6,
  },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 8 },
  statBorder: { borderRightWidth: 1, borderRightColor: colors.border },
  statLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  statSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgChip,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  fileIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fileName: { flex: 1, fontSize: 13, color: colors.textPrimary },
  fileBadge: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  fileOpen: { fontSize: 13, fontWeight: '700', color: colors.accent },
});
