import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { getReceivedShareDetail, type ReceivedShareDetail } from '../services/supabase/received';
import { createReservation } from '../services/supabase/reservations';
import { ShareModal } from '../components/share/ShareModal';
import { PreShareModal } from '../components/share/PreShareModal';
import { ManageSharesModal } from '../components/share/ManageSharesModal';
import { ReserveModal } from '../components/reservations/ReserveModal';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { ErrorState, LoadingState } from '../components/shared/StateView';
import { webOnly } from '../components/layout/web';
import type { ForwardContext } from '../services/supabase/shares';
import { colors, radius } from '../theme/tokens';
import { toast } from '../stores/toast';
import { useLightbox } from '../components/shared/Lightbox';
import { useIsMobile } from '../hooks/useIsMobile';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceivedDetail'>;

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥' };

function money(currency: string | null, price: number | null): string {
  if (price === null || price === undefined) return 'Price on request';
  const symbol = currency ? CURRENCY_SYMBOL[currency] ?? `${currency} ` : '';
  return `${symbol}${price.toLocaleString()}`;
}

/** Digits-only phone for a wa.me link (strips spaces, +, dashes, parens). */
function waNumber(phone: string | null): string {
  return (phone ?? '').replace(/[^\d]/g, '');
}

/** Compact age for the subtitle, e.g. "today", "1d ago", "5d ago". */
function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days) || days <= 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

export function ReceivedDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { shareId } = route.params;
  const queryClient = useQueryClient();
  const { open: openLightbox } = useLightbox();

  const [preShareOpen, setPreShareOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardCtx, setForwardCtx] = useState<ForwardContext | null>(null);
  const [sharedWithOpen, setSharedWithOpen] = useState(false);

  const [reserveOpen, setReserveOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['receivedDetail', shareId],
    queryFn: () => getReceivedShareDetail(shareId),
    staleTime: 30_000,
  });

  const reserveMutation = useMutation({
    mutationFn: (vars: { inventoryId: string; qty: number; price: number | null; message: string | null }) =>
      createReservation(vars.inventoryId, shareId, vars.qty, vars.price, vars.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['receivedDetail', shareId] });
      setReserveOpen(false);
      toast.success('Reservation request sent!');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not reserve.'),
  });

  const continueForward = (price: number | null, remark: string | null): void => {
    setForwardCtx({
      parentShareId: shareId,
      price,
      currency: data?.display_currency ?? 'AED',
      remark,
    });
    setPreShareOpen(false);
    setForwardOpen(true);
  };

  const back = (): void => navigation.goBack();

  if (isLoading) {
    return (
      <MainLayout active="received">
        <PageHeader title="Shared Item" leading={<BackLink onPress={back} />} />
        <LoadingState />
      </MainLayout>
    );
  }
  if (isError || !data) {
    return (
      <MainLayout active="received">
        <PageHeader title="Shared Item" leading={<BackLink onPress={back} />} />
        <ErrorState message={error instanceof Error ? error.message : 'Failed to load.'} />
      </MainLayout>
    );
  }

  const subtitle = `${data.product_code ?? '—'} • ${data.category ?? 'General'} • ${daysAgo(data.created_at)}`;

  const modals = (
    <>
      {/* Shared With — the forwards I made from this received share (privacy-scoped
          to my own recipients). "Forward to More" reopens the forward flow. */}
      <ManageSharesModal
        visible={sharedWithOpen}
        parentShareId={shareId}
        onClose={() => setSharedWithOpen(false)}
        onShareMore={() => {
          setSharedWithOpen(false);
          setPreShareOpen(true);
        }}
      />

      {/* Step 1 — Pre-Share / Forward gate (set your own price + remark) */}
      <PreShareModal
        visible={preShareOpen}
        currency={data.display_currency ?? 'AED'}
        unit={data.unit}
        onClose={() => setPreShareOpen(false)}
        onContinue={continueForward}
      />

      {/* Step 2 — ShareModal in forward mode */}
      {forwardCtx ? (
        <ShareModal
          visible={forwardOpen}
          inventoryId={data.inventory_id}
          forward={forwardCtx}
          card={{
            title: data.title,
            quantityAvailable: data.available_to_me,
            quantityTotal: data.quantity,
            unit: data.unit,
          }}
          onClose={() => setForwardOpen(false)}
          onShared={() => {
            void queryClient.invalidateQueries({ queryKey: ['receivedDetail', shareId] });
            void queryClient.invalidateQueries({ queryKey: ['forwardShares', shareId] });
          }}
        />
      ) : null}

      {/* Reserve Quantity modal */}
      <ReserveModal
        visible={reserveOpen}
        available={data.available_to_me}
        unit={data.unit}
        currency={data.display_currency ?? 'AED'}
        price={data.display_price}
        submitting={reserveMutation.isPending}
        onClose={() => setReserveOpen(false)}
        onSubmit={(qty, price, message) =>
          reserveMutation.mutate({ inventoryId: data.inventory_id, qty, price, message })
        }
      />
    </>
  );

  // Same redesigned layout on web + mobile; on desktop it's a centred column.
  return (
    <MainLayout active="received">
      <PageBody>
        <BackLink onPress={back} label="Back to Received" />
        <View style={styles.detailColumn}>
          <MobileReceivedBody
            data={data}
            subtitle={subtitle}
            onReserve={() => setReserveOpen(true)}
            onShare={() => setPreShareOpen(true)}
            onSharedWith={() => setSharedWithOpen(true)}
            openLightbox={openLightbox}
          />
        </View>
      </PageBody>
      {modals}
    </MainLayout>
  );
}

function BackLink({ onPress, label = 'Back' }: { onPress: () => void; label?: string }): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const color = hovered ? colors.accent : colors.textSecondary;
  return (
    <Pressable
      style={[styles.back, webOnly({ cursor: 'pointer' })]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      hitSlop={6}
    >
      <Ionicons name="arrow-back" size={14} color={color} />
      <Text style={[styles.backText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const HERO_HEIGHT = 240;
/** Taller hero on wide screens so a contained (uncropped) photo reads at a usable size. */
const HERO_HEIGHT_WEB = 460;

/** Extension → badge colours for the packing-list file rows. */
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

/**
 * Full-width hero gallery. Index-controlled (not native scroll-paging): shows
 * ONE fully-contained photo and navigates via prev/next arrows, tappable dots,
 * or swipe. Avoids react-native-web's flaky `pagingEnabled` snap (images landed
 * mid-scroll, looking cropped) and unreliable momentum events (dots never
 * advanced). Every photo shows whole — portrait or landscape.
 */
function HeroCarousel({
  photos,
  onShare,
  onOpen,
}: {
  photos: string[];
  onShare: () => void;
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
        <Pressable style={[styles.heroBtn, styles.heroBtnRight, webOnly({ cursor: 'pointer' })]} onPress={onShare}>
          <Ionicons name="share-social-outline" size={17} color="#FFFFFF" />
        </Pressable>
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

/** A label/value info row in the mobile title card. */
function MInfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }): React.JSX.Element {
  return (
    <View style={styles.mInfoRow}>
      <Text style={styles.mInfoLabel}>{label}</Text>
      <Text style={[styles.mInfoValue, valueColor ? { color: valueColor } : null]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/** One cell in the mobile stat grid. */
function MStat({
  label,
  value,
  sub,
  color,
  onPress,
  last = false,
}: {
  label: string;
  value: number;
  sub: string;
  color?: string;
  onPress?: () => void;
  last?: boolean;
}): React.JSX.Element {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      style={[styles.mStat, last ? null : styles.mStatBorder, onPress ? webOnly({ cursor: 'pointer' }) : null]}
    >
      <Text style={styles.mStatLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.mStatValue, color ? { color } : null]} numberOfLines={1}>
        {value.toLocaleString()}
      </Text>
      <Text style={styles.mStatSub}>{sub}</Text>
    </Wrap>
  );
}

/** Packing-list file row with a coloured type badge. */
function FileRow({ name, onPress }: { name: string; onPress: () => void }): React.JSX.Element {
  const ext = fileExt(name);
  const c = FILE_BADGE[ext] ?? { color: colors.textSecondary, bg: colors.bgChip };
  return (
    <Pressable style={[styles.mFileRow, webOnly({ cursor: 'pointer' })]} onPress={onPress} accessibilityLabel={`Open ${name}`}>
      <View style={[styles.mFileIcon, { backgroundColor: c.bg }]}>
        <Ionicons name="document-text-outline" size={18} color={c.color} />
      </View>
      <Text style={styles.mFileName} numberOfLines={1}>
        {name}
      </Text>
      {ext ? (
        <Text style={[styles.mFileBadge, { color: c.color }]}>{ext.toUpperCase()}</Text>
      ) : null}
    </Pressable>
  );
}

/** Mobile redesign of the received-item detail (mirror mockup). */
function MobileReceivedBody({
  data,
  subtitle,
  onReserve,
  onShare,
  onSharedWith,
  openLightbox,
}: {
  data: ReceivedShareDetail;
  subtitle: string;
  onReserve: () => void;
  onShare: () => void;
  onSharedWith: () => void;
  openLightbox: (photos: string[], index: number) => void;
}): React.JSX.Element {
  const initial = (data.shared_by_company ?? 'V').trim().charAt(0).toUpperCase();
  const phone = data.shared_by_phone;
  return (
    <View>
      {data.photoUrls.length > 0 ? (
        <HeroCarousel photos={data.photoUrls} onShare={onShare} onOpen={(i) => openLightbox(data.photoUrls, i)} />
      ) : null}

      {/* Title + info + stats */}
      <View style={styles.mCard}>
        <Text style={styles.mSub} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text style={styles.mTitle}>{data.title}</Text>
        <View style={styles.mDivider} />
        <MInfoRow label="Stock location" value={data.stock_location || '—'} />
        <MInfoRow label="Origin" value={data.origin || '—'} />
        <MInfoRow
          label="Price"
          value={`${money(data.display_currency, data.display_price)}${data.display_price !== null ? ` / ${data.unit}` : ''}`}
          valueColor={colors.green}
        />

        <View style={styles.mStatGrid}>
          <MStat label="Total Qty" value={data.quantity} sub={data.unit} />
          <MStat label="Available" value={data.available_to_me} sub={data.unit} color={colors.green} />
          <MStat label="Reserved by me" value={data.reserved_by_me} sub={data.unit} color={colors.orange} />
          <MStat label="Shared with" value={data.shared_with} sub="contacts" color={colors.purple} onPress={onSharedWith} last />
        </View>
      </View>

      {/* Reserve + Share */}
      <View style={styles.mActions}>
        <Pressable style={[styles.mReserve, webOnly({ cursor: 'pointer' })]} onPress={onReserve}>
          <Ionicons name="cube-outline" size={16} color="#FFFFFF" />
          <Text style={styles.mReserveText}>Reserve</Text>
        </Pressable>
        <Pressable style={[styles.mShareBtn, webOnly({ cursor: 'pointer' })]} onPress={onShare}>
          <Ionicons name="share-social-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.mShareText}>Share</Text>
        </Pressable>
      </View>

      {data.forward_remark ? (
        <View style={styles.remark}>
          <Text style={styles.remarkText}>{data.forward_remark}</Text>
        </View>
      ) : null}

      {/* Details */}
      {data.description ? (
        <View style={styles.mCard}>
          <View style={styles.mCardHead}>
            <Ionicons name="reader-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.mCardTitle}>Details</Text>
          </View>
          <Text style={styles.detailsText}>{data.description}</Text>
        </View>
      ) : null}

      {/* Packing list */}
      {data.files.length > 0 ? (
        <View style={styles.mCard}>
          <View style={styles.mCardHead}>
            <Ionicons name="document-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.mCardTitle}>Packing list and spec sheets</Text>
          </View>
          {data.files.map((f) => (
            <FileRow key={f.url} name={f.name} onPress={() => Linking.openURL(f.url)} />
          ))}
        </View>
      ) : null}

      {/* Shared by */}
      <View style={styles.mCard}>
        <View style={styles.mCardHead}>
          <Ionicons name="person-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.mCardTitle}>Shared by</Text>
        </View>
        <View style={styles.mSharedRow}>
          <View style={styles.mSharedAvatar}>
            <Text style={styles.mSharedAvatarText}>{initial}</Text>
          </View>
          <View style={styles.mSharedInfo}>
            <Text style={styles.mSharedName} numberOfLines={1}>
              {data.shared_by_company ?? 'A vendor'}
            </Text>
            {data.contact_person ? (
              <Text style={styles.mSharedContact} numberOfLines={1}>
                Contact: {data.contact_person}
              </Text>
            ) : null}
          </View>
        </View>
        {phone || data.shared_by_email ? (
          <View style={styles.mContactBtns}>
            {phone ? (
              <Pressable style={[styles.mContactBtn, { backgroundColor: colors.greenLight }]} onPress={() => Linking.openURL(`tel:${phone}`)} accessibilityLabel="Call">
                <Ionicons name="call-outline" size={18} color={colors.green} />
              </Pressable>
            ) : null}
            {phone ? (
              <Pressable style={[styles.mContactBtn, { backgroundColor: colors.greenLight }]} onPress={() => Linking.openURL(`https://wa.me/${waNumber(phone)}`)} accessibilityLabel="WhatsApp">
                <Ionicons name="logo-whatsapp" size={18} color={colors.green} />
              </Pressable>
            ) : null}
            {data.shared_by_email ? (
              <Pressable style={[styles.mContactBtn, { backgroundColor: colors.accentLight }]} onPress={() => Linking.openURL(`mailto:${data.shared_by_email}`)} accessibilityLabel="Email">
                <Ionicons name="mail-outline" size={18} color={colors.accent} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StatCol({
  value,
  label,
  unit,
  valueColor,
  bg,
  icon,
  last = false,
  onPress,
  mobile = false,
}: {
  value: number;
  label: string;
  unit?: string;
  valueColor?: string;
  bg?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  last?: boolean;
  /** When set, the column becomes tappable (e.g. open the Shared With list). */
  onPress?: () => void;
  mobile?: boolean;
}): React.JSX.Element {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      style={[
        styles.statCol,
        mobile ? styles.statColMobile : null,
        bg ? { backgroundColor: bg } : null,
        !mobile && !last ? styles.statColDivider : null,
        onPress ? webOnly({ cursor: 'pointer' }) : null,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValRow}>
        <Text style={[styles.statVal, valueColor ? { color: valueColor } : null]}>{value.toLocaleString()}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
        {icon ? <Ionicons name={icon} size={15} color={colors.accent} /> : null}
      </View>
    </Wrap>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },

  // Redesigned detail body — centred column on desktop, full-width on mobile.
  detailColumn: { width: '100%', maxWidth: 760, alignSelf: 'center' },

  // ---- Mobile redesign ----------------------------------------------------
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

  mCard: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  mSub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  mTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 6 },
  mDivider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  mInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  mInfoLabel: { fontSize: 14, color: colors.textSecondary },
  mInfoValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },

  mStatGrid: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: 6,
  },
  mStat: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, justifyContent: 'flex-start' },
  mStatBorder: { borderRightWidth: 1, borderRightColor: colors.border },
  mStatLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 },
  mStatValue: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  mStatSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  mActions: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  mReserve: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.green,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  mReserveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  mShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.bgWhite,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: radius.md,
  },
  mShareText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },

  mCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  mCardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  mFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgChip,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  mFileIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  mFileName: { flex: 1, fontSize: 13, color: colors.textPrimary },
  mFileBadge: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },

  mSharedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mSharedAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  mSharedAvatarText: { fontSize: 16, fontWeight: '800', color: colors.accent },
  mSharedInfo: { flex: 1, minWidth: 0 },
  mSharedName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  mSharedContact: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  mContactBtns: { flexDirection: 'row', gap: 12, marginTop: 14 },
  mContactBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },

  back: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 16 },
  backText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  // Two-column grid: main content + Shared By side panel (wraps on narrow screens).
  // The aside is a fixed, compact rail so the main details column gets the rest
  // of the width; both still wrap to full-width on narrow viewports.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' },
  main: { flexGrow: 1, flexShrink: 1, flexBasis: 500, minWidth: 320 },
  aside: { flexGrow: 0, flexShrink: 0, flexBasis: 380, minWidth: 340 },

  // Header card holding the title block, actions, and the stat bar.
  headCard: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg, // 16
    padding: 20,
    marginBottom: 16,
  },
  headTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  titleBlock: { flexShrink: 1, minWidth: 0 },
  h1: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  subRow: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  privacy: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 6, lineHeight: 17 },

  // Header actions
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  reserveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.green, // #16A34A
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.md, // 10
    ...webOnly({ cursor: 'pointer' }),
  },
  reserveBtnText: { color: colors.bgWhite, fontSize: 13, fontWeight: '600' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgWhite,
    borderWidth: 1.5,
    borderColor: colors.borderDark, // #CBD5E1
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    ...webOnly({ cursor: 'pointer' }),
  },
  shareBtnText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' }, // #0F172A

  // Cards — padding 16px 20px, radius 16
  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg, // 16
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: colors.textPrimary,
    marginBottom: 14,
  },

  // Price
  price: { fontSize: 20, fontWeight: '800', color: colors.accent, marginBottom: 4 },
  priceUnit: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  remark: {
    backgroundColor: colors.yellowLight,
    borderWidth: 1,
    borderColor: colors.yellowBorder,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  remarkText: { fontSize: 13, color: colors.amber },

  // 4-stat row — single card, columns split by a right border (overflow hidden)
  statCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg, // 16
    overflow: 'hidden',
  },
  statCardMobile: { flexWrap: 'wrap' },
  statCol: { flex: 1, justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 12 },
  // 2×2 grid cell on mobile with grid lines via top/right borders.
  statColMobile: { flexBasis: '50%', flexGrow: 0, minWidth: 0, borderTopWidth: 1, borderTopColor: colors.border },
  statColDivider: { borderRightWidth: 1, borderRightColor: colors.border }, // #E2E8F0
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted, // #94A3B8
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  statValRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  statVal: { fontSize: 20, fontWeight: '800', color: colors.primary },
  statUnit: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },

  // Stock location
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  locationText: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  locationLabel: { fontWeight: '700' },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoGridMobile: { flexDirection: 'column' },
  photo: { width: 200, height: 150, borderRadius: radius.md, backgroundColor: colors.bgChip },
  photoFull: { width: '100%' },
  photoMobile: { width: '100%', height: 240 },

  // Single-value section body (Stock Location / Origin).
  sectionValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  // Details text block
  detailsText: { fontSize: 13, color: colors.textSecondary, lineHeight: 22 },

  // Files
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgChip, // #F1F5F9
    borderRadius: radius.md, // 10
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  fileName: { flex: 1, fontSize: 13, color: colors.textPrimary },

  // Shared By side panel (light blue).
  sharedPanel: {
    backgroundColor: colors.accentLight, // #EFF6FF
    borderWidth: 1,
    borderColor: colors.accentMid, // #DBEAFE
    borderRadius: radius.lg,
    padding: 20,
  },
  sharedHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sharedIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accentMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  sharedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  sharedLabelSpaced: { marginTop: 16 },
  sharedValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  contactBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.accentMid,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
});
