import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import {
  archiveInventory,
  deleteInventory,
  getInventoryDetail,
  type InventoryDetail,
  type InventoryDocument,
  type ItemReservation,
  type ShareActivity,
} from '../services/supabase/inventory';
import { createPublicLink } from '../services/supabase/shares';
import { copyToClipboard, shareText } from '../utils/clipboard';
import { StatusChip } from '../components/shared/StatusChip';
import { AppButton } from '../components/shared/AppButton';
import { ShareModal } from '../components/share/ShareModal';
import { useLightbox } from '../components/shared/Lightbox';
import { useAuthStore, selectCanShare } from '../stores/authStore';
import { toast } from '../stores/toast';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'InventoryDetail'>;

function money(currency: string, price: number | null): string {
  if (price === null || price === undefined) return 'Price on request';
  return `${currency} ${price.toLocaleString()}`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(diff)) return '';
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk} week${wk === 1 ? '' : 's'} ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
  const yr = Math.round(day / 365);
  return `${yr} year${yr === 1 ? '' : 's'} ago`;
}

export function InventoryDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { inventoryId } = route.params;
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const canShare = useAuthStore(selectCanShare);
  const { open: openLightbox } = useLightbox();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventoryDetail', inventoryId],
    queryFn: () => getInventoryDetail(inventoryId),
    staleTime: 30_000,
  });

  // Refresh when returning (e.g. after editing the item).
  useFocusEffect(
    React.useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const invalidateLists = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const linkMutation = useMutation({
    mutationFn: () => createPublicLink(inventoryId),
    onSuccess: async ({ url }) => {
      const copied = await copyToClipboard(url);
      if (copied) toast.success('Link copied to clipboard!');
      else await shareText(url);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not create link.'),
  });

  const onShare = (): void => {
    if (!canShare) {
      Alert.alert('Complete your profile', 'Finish your company profile before sharing inventory.');
      return;
    }
    setShareOpen(true);
  };

  const archiveMutation = useMutation({
    mutationFn: () => archiveInventory(inventoryId),
    onSuccess: () => {
      invalidateLists();
      void refetch();
    },
    onError: (e) => Alert.alert('Could not archive', e instanceof Error ? e.message : 'Try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInventory(inventoryId),
    onSuccess: () => {
      invalidateLists();
      setDeleteOpen(false);
      toast.delete('Item deleted');
      navigation.navigate('Main', { screen: 'Inventory' });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not delete item.'),
  });

  const onMomentum = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const w = e.nativeEvent.layoutMeasurement.width || width;
    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / w));
  };

  const closeMenuThen = (fn: () => void): void => {
    setMenuOpen(false);
    fn();
  };

  const confirmArchive = (): void =>
    Alert.alert('Archive item?', 'Archived items are hidden from your active list but kept on record.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', onPress: () => archiveMutation.mutate() },
    ]);

  // Opens the in-app delete confirmation modal (never the browser's confirm()).
  const confirmDelete = (): void => setDeleteOpen(true);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.emerald} size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Failed to load.'}</Text>
        <Pressable onPress={() => void refetch()} style={styles.retry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const { item, photoUrls, documents, shareActivity, reservations } = data as InventoryDetail;
  const reserved = Math.max(item.quantity - item.quantity_available, 0);
  const specEntries = Object.entries(item.specs ?? {});

  return (
    <View style={styles.fill}>
      {/* Navy header with back + ⋯ menu */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.headerSide}>
            <Text style={styles.headerIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Item Details</Text>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} style={[styles.headerSide, styles.headerSideRight]}>
            <Text style={styles.headerIcon}>⋯</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View>
          {/* Photo carousel */}
            <View style={[styles.carousel, { width, height: width * 0.66 }]}>
              {photoUrls.length > 0 ? (
                <>
                  <FlatList
                    data={photoUrls}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(u, i) => `${i}-${u}`}
                    onMomentumScrollEnd={onMomentum}
                    renderItem={({ item: url, index: i }) => (
                      <Pressable onPress={() => openLightbox(photoUrls, i)}>
                        <Image source={{ uri: url }} style={{ width, height: width * 0.66 }} resizeMode="cover" />
                      </Pressable>
                    )}
                  />
                  {photoUrls.length > 1 ? (
                    <View style={styles.dots}>
                      {photoUrls.map((u, i) => (
                        <View key={`${i}-${u}`} style={[styles.dot, i === photoIndex ? styles.dotActive : null]} />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.carouselPlaceholder}>📦</Text>
              )}
            </View>

            <View style={styles.content}>
              {/* Title + status + price */}
              <View style={styles.titleRow}>
                <Text style={styles.title}>{item.title}</Text>
                <StatusChip status={item.status} />
              </View>
              <Text style={styles.subMeta}>
                {item.product_code ? `SKU: ${item.product_code}` : 'No SKU'}
                {item.category ? ` · ${item.category}` : ''}
              </Text>
              <Text style={styles.price}>
                {money(item.currency, item.price)}
                {item.price !== null ? <Text style={styles.priceUnit}> / {item.unit}</Text> : null}
              </Text>

              {/* 4-stat row */}
              <View style={styles.statRow}>
                <Stat value={item.quantity} label="Total" />
                <Stat value={reserved} label="Reserved" />
                <Stat value={item.quantity_available} label="Available" />
                <Stat value={item.shared_count} label="Shared" />
              </View>

              {/* Details */}
              <Section title="Details">
                <DetailRow label="Origin" value={item.origin ?? '—'} />
                <DetailRow label="Stock Location" value={item.stock_location ?? '—'} />
                <DetailRow label="Unit" value={item.unit} />
                <DetailRow label="Currency" value={item.currency} />
              </Section>

              {/* Description */}
              {item.description ? (
                <Section title="Description">
                  <Text style={styles.description}>{item.description}</Text>
                </Section>
              ) : null}

              {/* Documents */}
              {documents.length > 0 ? (
                <Section title="Documents">
                  {documents.map((doc) => (
                    <DocumentRow key={doc.storage_path} doc={doc} />
                  ))}
                </Section>
              ) : null}

              {/* Specifications */}
              {specEntries.length > 0 ? (
                <Section title="Specifications">
                  {specEntries.map(([k, v]) => (
                    <DetailRow key={k} label={k} value={String(v)} />
                  ))}
                </Section>
              ) : null}

              {/* Share Activity */}
              <Section title="Share Activity">
                {shareActivity.length === 0 ? (
                  <Text style={styles.empty}>Not shared with anyone yet.</Text>
                ) : (
                  shareActivity.map((s, i) => <ShareRow key={i} share={s} />)
                )}
              </Section>

              {/* Reservations on this item */}
              <Section title="Reservations on this item" last>
                {reservations.length === 0 ? (
                  <Text style={styles.empty}>No active reservations.</Text>
                ) : (
                  reservations.map((r) => <ReservationRow key={r.reservation_id} reservation={r} currency={item.currency} />)
                )}
              </Section>
            </View>
          </View>
      </ScrollView>

      {/* Bottom action bar */}
      <SafeAreaView edges={['bottom']} style={styles.actionsSafe}>
        <View style={styles.actions}>
          <AppButton
            title="Edit"
            variant="outline"
            style={styles.actionFlex}
            onPress={() => navigation.navigate('InventoryEdit', { inventoryId })}
          />
          <AppButton title="Share" style={styles.actionFlex} onPress={onShare} />
        </View>
      </SafeAreaView>

      <ShareModal
        visible={shareOpen}
        inventoryId={inventoryId}
        card={{
          title: item.title,
          quantityAvailable: item.quantity_available,
          quantityTotal: item.quantity,
          unit: item.unit,
        }}
        onClose={() => setShareOpen(false)}
        onShared={() => void refetch()}
      />

      {/* ⋯ menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <MenuItem
              label="Generate Public Link"
              onPress={() => closeMenuThen(() => linkMutation.mutate())}
            />
            <MenuItem
              label="Manage Shares"
              onPress={() => closeMenuThen(() => navigation.navigate('ManageShares', { inventoryId }))}
            />
            <MenuItem label="Archive Item" onPress={() => closeMenuThen(confirmArchive)} />
            <MenuItem label="Delete Item" destructive onPress={() => closeMenuThen(confirmDelete)} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirmation (in-app modal — never the browser confirm) */}
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <Pressable style={styles.confirmOverlay} onPress={() => setDeleteOpen(false)}>
          <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.confirmTitle}>Delete Item</Text>
            <Text style={styles.confirmBody}>
              Are you sure you want to delete this item? This action cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmBtn, styles.confirmCancel]}
                onPress={() => setDeleteOpen(false)}
                disabled={deleteMutation.isPending}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, styles.confirmDelete, deleteMutation.isPending ? styles.confirmBtnDisabled : null]}
                onPress={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Text style={styles.confirmDeleteText}>{deleteMutation.isPending ? 'Deleting…' : 'Delete'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }): React.JSX.Element {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.section, last ? styles.sectionLast : null]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function DocumentRow({ doc }: { doc: InventoryDocument }): React.JSX.Element {
  const open = (): void => {
    if (doc.url) void Linking.openURL(doc.url);
  };
  return (
    <Pressable style={styles.docRow} onPress={open} disabled={!doc.url}>
      <Text style={styles.docIcon}>📄</Text>
      <Text style={styles.docName} numberOfLines={1}>
        {doc.name}
      </Text>
      <Text style={styles.docOpen}>Open ↗</Text>
    </Pressable>
  );
}

function ShareRow({ share }: { share: ShareActivity }): React.JSX.Element {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>🟢 {share.recipient_company ?? 'A vendor'}</Text>
      <Text style={styles.timeValue}>{relativeTime(share.shared_at)}</Text>
    </View>
  );
}

function ReservationRow({
  reservation,
  currency,
}: {
  reservation: ItemReservation;
  currency: string;
}): React.JSX.Element {
  const r = reservation;
  return (
    <View style={styles.resCard}>
      <View style={styles.resThumb}>
        <Text style={styles.resThumbIcon}>🤝</Text>
      </View>
      <View style={styles.flexShrink}>
        <Text style={styles.resName} numberOfLines={1}>
          {r.requester_company ?? 'A vendor'}
        </Text>
        <Text style={styles.resDetail} numberOfLines={1}>
          Qty {r.quantity.toLocaleString()}
          {r.offered_price !== null ? ` · Offered ${currency} ${r.offered_price.toLocaleString()}/unit` : ''}
        </Text>
      </View>
      <StatusChip status={r.status} />
    </View>
  );
}

function MenuItem({
  label,
  onPress,
  destructive,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}): React.JSX.Element {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed ? styles.menuItemPressed : null]} onPress={onPress}>
      <Text style={[styles.menuLabel, destructive ? styles.menuLabelDestructive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50, padding: 24 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  retry: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.navy, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  flexShrink: { flexShrink: 1 },

  headerSafe: { backgroundColor: colors.navy },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  headerSide: { width: 34, alignItems: 'flex-start' },
  headerSideRight: { alignItems: 'flex-end' },
  headerIcon: { color: '#FFFFFF', fontSize: 24, fontWeight: '600' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  carousel: { backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  carouselPlaceholder: { fontSize: 64 },
  dots: { position: 'absolute', bottom: 12, flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#FFFFFF' },

  content: { padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 19, fontWeight: '800', color: colors.slate900 },
  subMeta: { fontSize: 12, color: colors.slate500, marginTop: 4 },
  price: { fontSize: 20, fontWeight: '800', color: colors.emerald, marginTop: 8 },
  priceUnit: { fontSize: 13, color: colors.slate400, fontWeight: '600' },

  statRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.slate100,
  },
  statVal: { fontSize: 17, fontWeight: '800', color: colors.navy },
  statLabel: { fontSize: 11, color: colors.slate500, marginTop: 2 },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.slate100,
  },
  sectionLast: { marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.slate900, marginBottom: 10 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    gap: 12,
  },
  detailLabel: { fontSize: 13, color: colors.slate500, flexShrink: 1 },
  detailValue: { fontSize: 13, fontWeight: '600', color: colors.slate700, textAlign: 'right', flexShrink: 1 },
  timeValue: { fontSize: 12, color: colors.slate400 },
  description: { fontSize: 13, color: colors.slate700, lineHeight: 21 },
  empty: { fontSize: 13, color: colors.slate400 },

  resCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  resThumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  resThumbIcon: { fontSize: 18 },
  resName: { fontSize: 13, fontWeight: '700', color: colors.slate900 },
  resDetail: { fontSize: 12, color: colors.slate500, marginTop: 2 },

  actionsSafe: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: colors.slate100 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  actionFlex: { flex: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.slate200, alignSelf: 'center', marginBottom: 8 },
  menuItem: { paddingVertical: 16, paddingHorizontal: 8, borderRadius: 10 },
  menuItemPressed: { backgroundColor: colors.slate50 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.slate900 },
  menuLabelDestructive: { color: colors.red },

  // Document rows in the Details body.
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.slate100,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  docIcon: { fontSize: 16 },
  docName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.slate700 },
  docOpen: { fontSize: 12, fontWeight: '700', color: colors.blue },

  // Delete confirmation modal — centered card.
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 380, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 22 },
  confirmTitle: { fontSize: 17, fontWeight: '800', color: colors.slate900, marginBottom: 8 },
  confirmBody: { fontSize: 14, color: colors.slate500, lineHeight: 21, marginBottom: 20 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  confirmBtn: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmCancel: { borderWidth: 1.5, borderColor: colors.slate200, backgroundColor: '#FFFFFF' },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: colors.slate700 },
  confirmDelete: { backgroundColor: '#DC2626' },
  confirmDeleteText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
