import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { getReceivedShareDetail } from '../services/supabase/received';
import { createReservation } from '../services/supabase/reservations';
import { ShareModal } from '../components/share/ShareModal';
import { PreShareModal } from '../components/share/PreShareModal';
import { ManageSharesModal } from '../components/share/ManageSharesModal';
import { ReserveModal } from '../components/reservations/ReserveModal';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
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
  const isMobile = useIsMobile();

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
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </MainLayout>
    );
  }
  if (isError || !data) {
    return (
      <MainLayout active="received">
        <PageHeader title="Shared Item" leading={<BackLink onPress={back} />} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Failed to load.'}</Text>
        </View>
      </MainLayout>
    );
  }

  const subtitle = `${data.product_code ?? '—'} | ${data.category ?? 'General'} • ${daysAgo(data.created_at)}`;

  return (
    <MainLayout active="received">
      <PageBody>
        <BackLink onPress={back} />

        {/* Two-column: main content + Shared By side panel. */}
        <View style={styles.grid}>
          {/* MAIN COLUMN */}
          <View style={styles.main}>
            {/* Header card — title + actions, then the 4-stat bar */}
            <View style={styles.headCard}>
              <View style={styles.headTop}>
                <View style={styles.titleBlock}>
                  <Text style={styles.h1} numberOfLines={2}>
                    {data.title}
                  </Text>
                  <Text style={styles.subRow} numberOfLines={1}>
                    {subtitle}
                  </Text>
                  <Text style={styles.privacy}>
                    Reserve directly here - no need to call. Your network remains private.
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  <Pressable style={styles.reserveBtn} onPress={() => setReserveOpen(true)}>
                    <Ionicons name="cube-outline" size={15} color={colors.bgWhite} />
                    <Text style={styles.reserveBtnText}>Reserve</Text>
                  </Pressable>
                  <Pressable style={styles.shareBtn} onPress={() => setPreShareOpen(true)}>
                    <Ionicons name="share-social-outline" size={15} color={colors.textPrimary} />
                    <Text style={styles.shareBtnText}>Share</Text>
                  </Pressable>
                </View>
              </View>

              {/* 4-stat bar — 2×2 grid on mobile so labels don't truncate. */}
              <View style={[styles.statCard, isMobile ? styles.statCardMobile : null]}>
                <StatCol value={data.quantity} label="Total Qty" unit={data.unit} mobile={isMobile} />
                <StatCol
                  value={data.reserved_by_me}
                  label="Reserved by me"
                  unit={data.unit}
                  valueColor={colors.orange}
                  bg={colors.orangeLight}
                  mobile={isMobile}
                />
                <StatCol
                  value={data.available_to_me}
                  label="Available"
                  unit={data.unit}
                  valueColor={colors.green}
                  bg={colors.greenLight}
                  mobile={isMobile}
                />
                <StatCol
                  value={data.shared_with}
                  label="Shared With"
                  icon="people-outline"
                  last
                  onPress={() => setSharedWithOpen(true)}
                  mobile={isMobile}
                />
              </View>
            </View>

            {/* Price + remark */}
            <Text style={styles.price}>
              {money(data.display_currency, data.display_price)}
              {data.display_price !== null ? <Text style={styles.priceUnit}> / {data.unit}</Text> : null}
            </Text>
            {data.forward_remark ? (
              <View style={styles.remark}>
                <Text style={styles.remarkText}>{data.forward_remark}</Text>
              </View>
            ) : null}

            {/* Stock location */}
            {data.stock_location ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.locationText}>
                  <Text style={styles.locationLabel}>Stock Location: </Text>
                  {data.stock_location}
                </Text>
              </View>
            ) : null}

            {/* Photos */}
            {data.photoUrls.length > 0 ? (
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="image-outline" size={16} color={colors.textPrimary} />
                  <Text style={styles.cardTitle}>Photos ({data.photoUrls.length})</Text>
                </View>
                <View style={styles.photoGrid}>
                  {data.photoUrls.map((url, i) => (
                    <Pressable
                      key={url}
                      onPress={() => openLightbox(data.photoUrls, i)}
                      style={webOnly({ cursor: 'pointer' })}
                      accessibilityLabel={`View photo ${i + 1}`}
                    >
                      <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Details */}
            {data.description ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Details</Text>
                <Text style={styles.detailsText}>{data.description}</Text>
              </View>
            ) : null}

            {/* Packing list / spec sheets */}
            {data.files.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📎 Packing List / Spec Sheets</Text>
                {data.files.map((file) => (
                  <Pressable
                    key={file.url}
                    style={styles.fileRow}
                    onPress={() => Linking.openURL(file.url)}
                    accessibilityLabel={`Open ${file.name}`}
                  >
                    <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* SIDE PANEL — Shared By */}
          <View style={styles.aside}>
            <View style={styles.sharedPanel}>
              <View style={styles.sharedHead}>
                <View style={styles.sharedIcon}>
                  <Ionicons name="person-outline" size={18} color={colors.accent} />
                </View>
                <Text style={styles.sharedTitle}>Shared By</Text>
              </View>

              <Text style={styles.sharedLabel}>Company</Text>
              <Text style={styles.sharedValue} numberOfLines={2}>
                {data.shared_by_company ?? 'A vendor'}
              </Text>

              {data.contact_person ? (
                <>
                  <Text style={[styles.sharedLabel, styles.sharedLabelSpaced]}>Contact Person</Text>
                  <Text style={styles.sharedValue}>{data.contact_person}</Text>
                </>
              ) : null}

              {data.shared_by_phone || data.shared_by_email ? (
                <View style={styles.contactRow}>
                  {data.shared_by_phone ? (
                    <Pressable
                      style={styles.contactBtn}
                      onPress={() => Linking.openURL(`tel:${data.shared_by_phone}`)}
                      accessibilityLabel="Call vendor"
                    >
                      <Ionicons name="call-outline" size={16} color={colors.accent} />
                    </Pressable>
                  ) : null}
                  {data.shared_by_phone ? (
                    <Pressable
                      style={styles.contactBtn}
                      onPress={() => Linking.openURL(`https://wa.me/${waNumber(data.shared_by_phone)}`)}
                      accessibilityLabel="Message vendor on WhatsApp"
                    >
                      <Ionicons name="logo-whatsapp" size={16} color={colors.green} />
                    </Pressable>
                  ) : null}
                  {data.shared_by_email ? (
                    <Pressable
                      style={styles.contactBtn}
                      onPress={() => Linking.openURL(`mailto:${data.shared_by_email}`)}
                      accessibilityLabel="Email vendor"
                    >
                      <Ionicons name="mail-outline" size={16} color={colors.accent} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </PageBody>

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
    </MainLayout>
  );
}

function BackLink({ onPress }: { onPress: () => void }): React.JSX.Element {
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
      <Text style={[styles.backText, { color }]}>Back</Text>
    </Pressable>
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
  photo: { width: 200, height: 150, borderRadius: radius.md, backgroundColor: colors.bgChip },

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
