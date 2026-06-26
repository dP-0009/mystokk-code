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
import { ReserveModal } from '../components/reservations/ReserveModal';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import type { ForwardContext } from '../services/supabase/shares';
import { colors, radius } from '../theme/tokens';
import { toast } from '../stores/toast';
import { useLightbox } from '../components/shared/Lightbox';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceivedDetail'>;

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥' };
const AVATAR_COLORS = ['#2563EB', '#16A34A', '#F97316', '#7C3AED', '#DC2626', '#0EA5E9'];

function money(currency: string | null, price: number | null): string {
  if (price === null || price === undefined) return 'Price on request';
  const symbol = currency ? CURRENCY_SYMBOL[currency] ?? `${currency} ` : '';
  return `${symbol}${price.toLocaleString()}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const day = Math.floor(diff / 86_400_000);
  if (day <= 0) {
    const hr = Math.floor(diff / 3_600_000);
    return hr <= 0 ? 'just now' : `${hr} hr${hr === 1 ? '' : 's'} ago`;
  }
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} week${wk === 1 ? '' : 's'} ago`;
  return `${Math.floor(day / 30)} month(s) ago`;
}

function avatarColor(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function initial(name: string | null): string {
  const ch = (name ?? '').trim().match(/[a-z0-9]/i)?.[0] ?? '?';
  return ch.toUpperCase();
}

export function ReceivedDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { shareId } = route.params;
  const queryClient = useQueryClient();
  const { open: openLightbox } = useLightbox();

  const [preShareOpen, setPreShareOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardCtx, setForwardCtx] = useState<ForwardContext | null>(null);

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

  const subtitle = [data.product_code, data.category ?? '—', relativeTime(data.created_at)]
    .filter((p) => p !== null && p !== '')
    .join(' | ');

  return (
    <MainLayout active="received">
      <PageHeader
        title={data.title}
        subtitle={subtitle}
        leading={<BackLink onPress={back} />}
        actions={
          <View style={styles.headerActions}>
            <Pressable style={styles.reserveBtn} onPress={() => setReserveOpen(true)}>
              <Ionicons name="cube-outline" size={15} color={colors.bgWhite} />
              <Text style={styles.reserveBtnText}>Reserve</Text>
            </Pressable>
            <Pressable style={styles.shareBtn} onPress={() => setPreShareOpen(true)}>
              <Ionicons name="share-social-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.shareBtnText}>Share</Text>
            </Pressable>
          </View>
        }
      />

      <PageBody>
        <View style={styles.container}>
          {/* Privacy note */}
          <Text style={styles.privacyNote}>
            You can share this with your network (your supplier details / pricing will not be forwarded)
          </Text>

          {/* SHARED BY card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shared By</Text>
            <View style={styles.sharedByRow}>
              <View style={[styles.avatar, { backgroundColor: avatarColor(data.shared_by_company ?? '?') }]}>
                <Text style={styles.avatarText}>{initial(data.shared_by_company)}</Text>
              </View>
              <View style={styles.sharedByInfo}>
                <Text style={styles.companyName} numberOfLines={1}>
                  {data.shared_by_company ?? 'A vendor'}
                </Text>
                <Text style={styles.companyMeta}>Company</Text>
                {data.contact_person ? (
                  <Text style={styles.companyMeta}>Contact Person: {data.contact_person}</Text>
                ) : null}
              </View>
            </View>
            <Text style={styles.sharedByHint}>
              Reserve directly here - no need to call. Your network remains private.
            </Text>
          </View>

          {/* Price */}
          <Text style={styles.price}>
            {money(data.display_currency, data.display_price)}
            {data.display_price !== null ? <Text style={styles.priceUnit}> / {data.unit}</Text> : null}
          </Text>

          {data.forward_remark ? (
            <View style={styles.remark}>
              <Text style={styles.remarkText}>{data.forward_remark}</Text>
            </View>
          ) : null}

          {/* 4-STAT ROW — one white card, columns split by a right border */}
          <View style={styles.statCard}>
            <StatCol value={data.quantity} label="Total Qty" />
            <StatCol value={data.reserved_by_me} label="Reserved by me" valueColor="#F97316" />
            <StatCol value={data.available_to_me} label="Available" valueColor="#16A34A" />
            <StatCol value={data.shared_with} label="Shared With" last />
          </View>

          {/* STOCK LOCATION */}
          {data.stock_location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.locationText}>
                <Text style={styles.locationLabel}>Stock Location: </Text>
                {data.stock_location}
              </Text>
            </View>
          ) : null}

          {/* PHOTOS */}
          {data.photoUrls.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Photos ({data.photoUrls.length})</Text>
              <View style={styles.photoGrid}>
                {data.photoUrls.map((url, i) => (
                  <Pressable key={url} onPress={() => openLightbox(data.photoUrls, i)}>
                    <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* DETAILS TEXT BLOCK */}
          {data.description ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Details</Text>
              <Text style={styles.detailsText}>{data.description}</Text>
            </View>
          ) : null}

          {/* PACKING LIST / SPEC SHEETS */}
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
      </PageBody>

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
          onShared={() => queryClient.invalidateQueries({ queryKey: ['receivedDetail', shareId] })}
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
  return (
    <Pressable style={styles.back} onPress={onPress} hitSlop={6}>
      <Ionicons name="arrow-back" size={15} color={colors.textSecondary} />
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );
}

function StatCol({
  value,
  label,
  valueColor,
  last = false,
}: {
  value: number;
  label: string;
  valueColor?: string;
  last?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.statCol, last ? null : styles.statColDivider]}>
      <Text style={[styles.statVal, valueColor ? { color: valueColor } : null]}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 860, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },

  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  backText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  // Header actions
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reserveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.green, // #16A34A
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.md, // 10
  },
  reserveBtnText: { color: colors.bgWhite, fontSize: 13, fontWeight: '600' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgWhite,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  shareBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

  // Privacy note
  privacyNote: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 16, lineHeight: 17 },

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
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: colors.textPrimary,
    marginBottom: 14,
  },

  // Shared By
  sharedByRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.bgWhite, fontSize: 15, fontWeight: '700' },
  sharedByInfo: { flex: 1, minWidth: 0 },
  companyName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  companyMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  sharedByHint: { fontSize: 12, color: colors.accent, fontStyle: 'italic', marginTop: 12 },

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
    marginBottom: 4,
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
    marginTop: 14,
    marginBottom: 16,
  },
  statCol: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 18, paddingHorizontal: 6 },
  statColDivider: { borderRightWidth: 1, borderRightColor: colors.border }, // #E2E8F0
  statVal: { fontSize: 20, fontWeight: '800', color: colors.primary },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted, // #94A3B8
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 4,
    textAlign: 'center',
  },

  // Stock location
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  locationText: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  locationLabel: { fontWeight: '700' },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: 92, height: 92, borderRadius: radius.md, backgroundColor: colors.bgChip },

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
});
