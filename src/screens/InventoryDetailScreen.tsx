import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { ShareModal } from '../components/share/ShareModal';
import { useLightbox } from '../components/shared/Lightbox';
import { MainLayout, PageBody } from '../components/layout';
import { webOnly } from '../components/layout/web';
import { useAuthStore, selectCanShare } from '../stores/authStore';
import { toast } from '../stores/toast';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'InventoryDetail'>;

const CAROUSEL_HEIGHT = 360;

function money(currency: string, price: number | null): string {
  if (price === null || price === undefined) return 'Price on request';
  return `${currency} ${price.toLocaleString()}`;
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days) || days <= 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
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
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(0);
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
      toast.delete('Item deleted successfully!');
      navigation.navigate('Main', { screen: 'Inventory' });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not delete item.'),
  });

  const onMomentum = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const w = e.nativeEvent.layoutMeasurement.width || 1;
    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / w));
  };

  // Escape closes the delete confirmation (web), mirroring the Cancel button.
  useEffect(() => {
    if (!deleteOpen || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setDeleteOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteOpen]);

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
      <MainLayout active="inventory">
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </MainLayout>
    );
  }

  if (isError || !data) {
    return (
      <MainLayout active="inventory">
        <View style={styles.center}>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Failed to load.'}</Text>
          <Pressable onPress={() => void refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </MainLayout>
    );
  }

  const { item, photoUrls, documents, shareActivity, reservations } = data as InventoryDetail;
  const reserved = Math.max(item.quantity - item.quantity_available, 0);
  const specEntries = Object.entries(item.specs ?? {});

  return (
    <MainLayout active="inventory">
      {/* Page header — back link, item name, meta + privacy note, and actions. */}
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <BackLink onPress={() => navigation.navigate('Main', { screen: 'Inventory' })} />
          <Text style={styles.h1} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.subRow} numberOfLines={1}>
            {item.product_code ?? '—'} | {item.category ?? 'General'} • {daysAgo(item.created_at)}
          </Text>
          <Text style={styles.privacy}>
            Shared only with YOUR trusted contacts, not to open market.
          </Text>
        </View>
        <View style={styles.headerActions}>
          <ShareButton onPress={onShare} />
          <EditButton onPress={() => navigation.navigate('InventoryEdit', { inventoryId })} />
          <OverflowButton onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      <PageBody>
        {/* Photo carousel — sized to the content column width. */}
        <View
          style={[styles.carousel, { height: CAROUSEL_HEIGHT }]}
          onLayout={(e) => setCarouselWidth(e.nativeEvent.layout.width)}
        >
          {photoUrls.length > 0 && carouselWidth > 0 ? (
            <>
              <FlatList
                data={photoUrls}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(u, i) => `${i}-${u}`}
                onMomentumScrollEnd={onMomentum}
                renderItem={({ item: url, index: i }) => (
                  <Pressable onPress={() => openLightbox(photoUrls, i)} style={webOnly({ cursor: 'pointer' })}>
                    <Image
                      source={{ uri: url }}
                      style={{ width: carouselWidth, height: CAROUSEL_HEIGHT }}
                      resizeMode="cover"
                    />
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

        {/* Status + price */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {money(item.currency, item.price)}
            {item.price !== null ? <Text style={styles.priceUnit}> / {item.unit}</Text> : null}
          </Text>
          <StatusChip status={item.status} />
        </View>

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

        {/* Reservation History */}
        <Section title="Reservation History">
          {reservations.length === 0 ? (
            <Text style={styles.empty}>No reservations yet.</Text>
          ) : (
            reservations.map((r) => (
              <ReservationHistoryRow key={r.reservation_id} reservation={r} currency={item.currency} />
            ))
          )}
        </Section>

        {/* Activity Log */}
        <Section title="Activity Log">
          {shareActivity.length === 0 ? (
            <Text style={styles.empty}>No activity yet.</Text>
          ) : (
            shareActivity.map((s, i) => <ActivityRow key={i} share={s} />)
          )}
        </Section>

        {/* Full-width delete button at the bottom of the page. */}
        <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
          <Text style={styles.deleteBtnText}>Delete Item</Text>
        </Pressable>
      </PageBody>

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

      {/* ⋯ overflow menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <MenuItem label="Generate Public Link" onPress={() => closeMenuThen(() => linkMutation.mutate())} />
            <MenuItem
              label="Manage Shares"
              onPress={() => closeMenuThen(() => navigation.navigate('ManageShares', { inventoryId }))}
            />
            <MenuItem label="Archive Item" onPress={() => closeMenuThen(confirmArchive)} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirmation (in-app modal — never the browser confirm) */}
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <Pressable style={styles.confirmOverlay} onPress={() => setDeleteOpen(false)}>
          <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.confirmIcon}>
              <Ionicons name="trash-outline" size={48} color={colors.red} />
            </View>
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
    </MainLayout>
  );
}

/** '← Back to Inventory' link — #475569, turns #2563EB on hover (web). */
function BackLink({ onPress }: { onPress: () => void }): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      hitSlop={6}
      style={[styles.backLink, webOnly({ cursor: 'pointer' })]}
    >
      <Ionicons name="arrow-back" size={14} color={hovered ? colors.accent : colors.textSecondary} />
      <Text style={[styles.backText, hovered ? styles.backTextHover : null]}>Back to Inventory</Text>
    </Pressable>
  );
}

/** Primary navy 'Share' button (mirror `.btn-p`). */
function ShareButton({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.shareBtn, webOnly({ cursor: 'pointer' })]}>
      <Ionicons name="share-social-outline" size={15} color={colors.bgWhite} />
      <Text style={styles.shareBtnText}>Share</Text>
    </Pressable>
  );
}

/** Outline 'Edit' button — 1.5px #CBD5E1 border on white. */
function EditButton({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.editBtn, webOnly({ cursor: 'pointer' })]}>
      <Ionicons name="create-outline" size={15} color={colors.textPrimary} />
      <Text style={styles.editBtnText}>Edit</Text>
    </Pressable>
  );
}

/** ⋯ overflow button — opens the secondary actions sheet. */
function OverflowButton({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.overflowBtn, webOnly({ cursor: 'pointer' })]} accessibilityLabel="More actions">
      <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
    </Pressable>
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
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
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

/** Reservation History row — dot + 'Vendor — qty @ price' + time + status badge. */
function ReservationHistoryRow({
  reservation,
  currency,
}: {
  reservation: ItemReservation;
  currency: string;
}): React.JSX.Element {
  const r = reservation;
  const price = r.offered_price !== null ? `${currency} ${r.offered_price.toLocaleString()}` : '—';
  return (
    <View style={styles.logRow}>
      <Text style={styles.logDot}>•</Text>
      <View style={styles.logBody}>
        <Text style={styles.logText} numberOfLines={1}>
          {r.requester_company ?? 'A vendor'} — {r.quantity.toLocaleString()} @ {price}
        </Text>
        <Text style={styles.logTime}>{relativeTime(r.created_at)}</Text>
      </View>
      <StatusChip status={r.status} />
    </View>
  );
}

/** Activity Log row — bullet + action text + date on the right. */
function ActivityRow({ share }: { share: ShareActivity }): React.JSX.Element {
  return (
    <View style={styles.activityRow}>
      <Text style={styles.logText} numberOfLines={1}>
        • Shared with {share.recipient_company ?? 'a vendor'}
      </Text>
      <Text style={styles.logTime}>{relativeTime(share.shared_at)}</Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgPage, padding: 24 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  retry: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },

  // Page header (mirror `.ph`) with a multi-line title block.
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingLeft: 28,
    // Extra right padding so the action buttons clear the fixed notification bell.
    paddingRight: 64,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: colors.bgWhite,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleBlock: { flexShrink: 1, minWidth: 0 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  backText: { fontSize: 13, color: colors.textSecondary },
  backTextHover: { color: colors.accent },
  h1: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  subRow: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  privacy: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 4 },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  // `.btn-p` — navy primary.
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary, // #0F172A
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  shareBtnText: { color: colors.bgWhite, fontSize: 13, fontWeight: '600' },
  // Outline edit button — 1.5px #CBD5E1 border.
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgWhite,
    borderWidth: 1.5,
    borderColor: colors.borderDark, // #CBD5E1
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  editBtnText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  overflowBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: colors.bgWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Carousel.
  carousel: {
    backgroundColor: colors.bgChip,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  carouselPlaceholder: { fontSize: 64 },
  dots: { position: 'absolute', bottom: 12, flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotActive: { backgroundColor: '#FFFFFF' },

  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 },
  price: { fontSize: 20, fontWeight: '800', color: colors.green },
  priceUnit: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },

  statRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statBox: {
    flex: 1,
    backgroundColor: colors.bgWhite,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statVal: { fontSize: 17, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  section: {
    backgroundColor: colors.bgWhite,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textPrimary, marginBottom: 10 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    gap: 12,
  },
  detailLabel: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  detailValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, textAlign: 'right', flexShrink: 1 },
  description: { fontSize: 13, color: colors.textSecondary, lineHeight: 21 },
  empty: { fontSize: 13, color: colors.textMuted },

  // Reservation History row.
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  logDot: { fontSize: 16, color: colors.textMuted, lineHeight: 18 },
  logBody: { flex: 1, minWidth: 0 },
  logText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  logTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  // Activity Log row — text left, date right.
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 7,
  },

  // Full-width delete button.
  deleteBtn: {
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: colors.redLight, // #FEF2F2
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: colors.red },

  // Document rows.
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  docIcon: { fontSize: 16 },
  docName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  docOpen: { fontSize: 12, fontWeight: '700', color: colors.accent },

  // ⋯ overflow sheet.
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  menuItem: { paddingVertical: 16, paddingHorizontal: 8, borderRadius: 10 },
  menuItemPressed: { backgroundColor: colors.bgPage },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  menuLabelDestructive: { color: colors.red },

  // Delete confirmation modal — centered card.
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 9999,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 16,
  },
  confirmIcon: { alignItems: 'center', marginBottom: 12 },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  confirmBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, textAlign: 'center' },
  confirmActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  confirmBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmCancel: { borderWidth: 1.5, borderColor: colors.borderDark, backgroundColor: '#FFFFFF' },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  confirmDelete: { backgroundColor: '#DC2626' },
  confirmDeleteText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});
