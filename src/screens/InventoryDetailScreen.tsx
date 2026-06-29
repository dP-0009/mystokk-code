import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
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
} from '../services/supabase/inventory';
import { createPublicLink, getItemDirectShares } from '../services/supabase/shares';
import { copyToClipboard, shareText } from '../utils/clipboard';
import { StatusChip } from '../components/shared/StatusChip';
import { ShareModal } from '../components/share/ShareModal';
import { ManageSharesModal } from '../components/share/ManageSharesModal';
import { useLightbox } from '../components/shared/Lightbox';
import { MainLayout, PageBody } from '../components/layout';
import { webOnly } from '../components/layout/web';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuthStore, selectCanShare } from '../stores/authStore';
import { toast } from '../stores/toast';
import { colors } from '../theme/tokens';
import type { ColorValue } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'InventoryDetail'>;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
  SAR: 'SAR ',
  PKR: '₨',
};

function money(currency: string, price: number | null): string {
  if (price === null || price === undefined) return 'Price on request';
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${price.toLocaleString()}`;
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days) || days <= 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
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
  return `${Math.round(day / 365)} year(s) ago`;
}

export function InventoryDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { inventoryId } = route.params;
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharesOpen, setSharesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canShare = useAuthStore(selectCanShare);
  const { open: openLightbox } = useLightbox();
  const isMobile = useIsMobile();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventoryDetail', inventoryId],
    queryFn: () => getInventoryDetail(inventoryId),
    staleTime: 30_000,
  });

  // Active direct shares (vendors + public links) — the "Shared With" count
  // reflects this list, kept in sync with the Manage Shares modal (same cache).
  const sharesQuery = useQuery({
    queryKey: ['itemShares', inventoryId],
    queryFn: () => getItemDirectShares(inventoryId),
    staleTime: 15_000,
  });

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
  const sharedWithCount = sharesQuery.data
    ? sharesQuery.data.filter((s) => s.status !== 'revoked').length
    : item.shared_count;
  const specEntries = Object.entries(item.specs ?? {});

  // Activity timeline — newest first, with the item's creation as the base event.
  const activity = [
    ...shareActivity.map((s) => ({
      label: s.recipient_company ? `Shared with ${s.recipient_company}` : 'Create Public Share',
      ts: s.shared_at,
    })),
    { label: 'Create Inventory', ts: item.created_at },
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <MainLayout active="inventory">
      <PageBody>
        {/* Far-left back link, just beside the sidebar (outside the centered card). */}
        <BackLink onPress={() => navigation.navigate('Main', { screen: 'Inventory' })} />

        <View style={styles.wrap}>
          <View style={styles.card}>
            {/* Header — stacks on mobile so the title gets full width and the
                action buttons drop below it. */}
            <View style={[styles.cardHeader, isMobile ? styles.cardHeaderMobile : null]}>
              <View style={styles.titleBlock}>
                <Text style={styles.h1} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.skuRow} numberOfLines={1}>
                  {item.product_code ?? '—'} | {item.category ?? 'General'}
                </Text>
                <Text style={styles.timeRow}>{daysAgo(item.created_at)}</Text>
                <Text style={styles.privacy}>Shared only with YOUR trusted contacts, not to open market.</Text>
              </View>
              <View style={[styles.headerActions, isMobile ? styles.headerActionsMobile : null]}>
                <ShareButton onPress={onShare} />
                <EditButton onPress={() => navigation.navigate('InventoryEdit', { inventoryId })} />
                <OverflowButton onPress={() => setMenuOpen(true)} />
              </View>
            </View>

            {/* Stat row — 4 columns on desktop; a 2×2 grid on mobile so labels
                don't truncate. */}
            <View style={[styles.statsRow, isMobile ? styles.statsRowMobile : null]}>
              <StatCell label="TOTAL QTY" labelColor={colors.textMuted} value={item.quantity} unit={item.unit} mobile={isMobile} />
              {isMobile ? null : <View style={styles.statDivider} />}
              <StatCell label="RESERVED" labelColor={colors.orange} value={reserved} unit={item.unit} mobile={isMobile} />
              {isMobile ? null : <View style={styles.statDivider} />}
              <StatCell label="AVAILABLE" labelColor={colors.green} value={item.quantity_available} unit={item.unit} mobile={isMobile} />
              {isMobile ? null : <View style={styles.statDivider} />}
              <StatCell
                label="SHARED WITH"
                labelColor={colors.textMuted}
                value={sharedWithCount}
                icon="people"
                onPress={() => setSharesOpen(true)}
                mobile={isMobile}
              />
            </View>

            {/* Price band */}
            <View style={styles.priceBand}>
              <Text style={styles.priceLabel}>
                Price: <Text style={styles.priceValue}>{money(item.currency, item.price)}</Text>
                {item.price !== null ? <Text style={styles.priceUnit}>{`  per ${item.unit}`}</Text> : null}
              </Text>
              <StatusChip status={item.status} />
            </View>

            {/* Photos — tap to open the carousel lightbox */}
            {photoUrls.length > 0 ? (
              <SubSection icon="image-outline" title={`Photos (${photoUrls.length})`}>
                <View style={styles.photoGrid}>
                  {photoUrls.map((url, i) => (
                    <Pressable
                      key={`${i}-${url}`}
                      onPress={() => openLightbox(photoUrls, i)}
                      style={[styles.photoThumb, webOnly({ cursor: 'pointer' })]}
                      accessibilityLabel={`View photo ${i + 1}`}
                    >
                      <Image source={{ uri: url }} style={styles.photoImg} resizeMode="cover" />
                    </Pressable>
                  ))}
                </View>
              </SubSection>
            ) : null}

            {/* Description */}
            {item.description ? (
              <SubSection icon="document-text-outline" title="Description">
                <Text style={styles.description}>{item.description}</Text>
              </SubSection>
            ) : null}

            {/* Details */}
            {item.origin || item.stock_location ? (
              <SubSection icon="information-circle-outline" title="Details">
                {item.origin ? <DetailRow label="Origin" value={item.origin} /> : null}
                {item.stock_location ? <DetailRow label="Stock Location" value={item.stock_location} /> : null}
              </SubSection>
            ) : null}

            {/* Documents */}
            {documents.length > 0 ? (
              <SubSection icon="folder-outline" title="Documents">
                {documents.map((doc) => (
                  <DocumentRow key={doc.storage_path} doc={doc} />
                ))}
              </SubSection>
            ) : null}

            {/* Specifications */}
            {specEntries.length > 0 ? (
              <SubSection icon="list-outline" title="Specifications">
                {specEntries.map(([k, v]) => (
                  <DetailRow key={k} label={k} value={String(v)} />
                ))}
              </SubSection>
            ) : null}

            {/* Reservation History */}
            {reservations.length > 0 ? (
              <SubSection icon="bookmark-outline" title="Reservation History">
                {reservations.map((r) => (
                  <ReservationHistoryRow key={r.reservation_id} reservation={r} currency={item.currency} />
                ))}
              </SubSection>
            ) : null}

            {/* Activity */}
            <SubSection icon="time-outline" title="Activity">
              {activity.map((a, i) => (
                <View key={i} style={styles.activityRow}>
                  <View style={styles.activityLeft}>
                    <View style={styles.activityDot} />
                    <Text style={styles.activityLabel} numberOfLines={1}>
                      {a.label}
                    </Text>
                  </View>
                  <Text style={styles.activityDate}>{shortDate(a.ts)}</Text>
                </View>
              ))}
            </SubSection>

            {/* Delete */}
            <Pressable style={[styles.deleteBtn, webOnly({ cursor: 'pointer' })]} onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={16} color={colors.red} />
              <Text style={styles.deleteBtnText}>Delete Item</Text>
            </Pressable>
          </View>
        </View>
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

      {/* Manage Shares — who I've shared this item with (owner-scoped). */}
      <ManageSharesModal
        visible={sharesOpen}
        inventoryId={inventoryId}
        onClose={() => setSharesOpen(false)}
        onShareMore={() => {
          setSharesOpen(false);
          onShare();
        }}
      />

      {/* ⋯ overflow menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <MenuItem label="Generate Public Link" onPress={() => closeMenuThen(() => linkMutation.mutate())} />
            <MenuItem label="Manage Shares" onPress={() => closeMenuThen(() => setSharesOpen(true))} />
            <MenuItem label="Archive Item" onPress={() => closeMenuThen(confirmArchive)} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirmation */}
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
      <Ionicons name="arrow-back" size={15} color={hovered ? colors.accent : colors.textSecondary} />
      <Text style={[styles.backText, hovered ? styles.backTextHover : null]}>Back to Inventory</Text>
    </Pressable>
  );
}

function ShareButton({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.shareBtn, webOnly({ cursor: 'pointer' })]}>
      <Ionicons name="share-social-outline" size={15} color={colors.bgWhite} />
      <Text style={styles.shareBtnText}>Share</Text>
    </Pressable>
  );
}

function EditButton({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.editBtn, webOnly({ cursor: 'pointer' })]}>
      <Ionicons name="create-outline" size={15} color={colors.textPrimary} />
      <Text style={styles.editBtnText}>Edit</Text>
    </Pressable>
  );
}

function OverflowButton({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.overflowBtn, webOnly({ cursor: 'pointer' })]} accessibilityLabel="More actions">
      <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

/** One cell of the stat row — coloured uppercase label, big value + unit/icon. */
function StatCell({
  label,
  labelColor,
  value,
  unit,
  icon,
  onPress,
  mobile = false,
}: {
  label: string;
  labelColor: ColorValue;
  value: number;
  unit?: string;
  icon?: IoniconName;
  onPress?: () => void;
  mobile?: boolean;
}): React.JSX.Element {
  return (
    <Pressable
      style={[styles.statCell, mobile ? styles.statCellMobile : null, onPress ? webOnly({ cursor: 'pointer' }) : null]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.statLabel, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value.toLocaleString()}</Text>
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
        {icon ? <Ionicons name={icon} size={13} color={colors.accent} style={styles.statIcon} /> : null}
      </View>
    </Pressable>
  );
}

/** A titled subsection with a leading icon and a top divider. */
function SubSection({
  icon,
  title,
  children,
}: {
  icon: IoniconName;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.subSection}>
      <View style={styles.subHeader}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
        <Text style={styles.subTitle}>{title}</Text>
      </View>
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

function ReservationHistoryRow({
  reservation,
  currency,
}: {
  reservation: ItemReservation;
  currency: string;
}): React.JSX.Element {
  const r = reservation;
  const price = r.offered_price !== null ? money(currency, r.offered_price) : '—';
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

function MenuItem({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed ? styles.menuItemPressed : null]} onPress={onPress}>
      <Text style={styles.menuLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgPage, padding: 24 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  retry: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },

  wrap: { width: '100%', maxWidth: 760, alignSelf: 'center' },

  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, alignSelf: 'flex-start' },
  backText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  backTextHover: { color: colors.accent },

  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
  },

  // Header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    padding: 22,
  },
  cardHeaderMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 14 },
  titleBlock: { flexShrink: 1, minWidth: 0 },
  h1: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  skuRow: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 6, letterSpacing: 0.3 },
  timeRow: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  privacy: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 8 },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
  headerActionsMobile: { justifyContent: 'flex-start' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  shareBtnText: { color: colors.bgWhite, fontSize: 13, fontWeight: '600' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgWhite,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
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

  // Stat row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statsRowMobile: { flexWrap: 'wrap', borderTopWidth: 0 },
  statCell: { flex: 1, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', gap: 6 },
  // 2×2 grid cell on mobile, with grid lines drawn via cell borders.
  statCellMobile: {
    flexBasis: '50%',
    flexGrow: 0,
    minWidth: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statDivider: { width: 1, backgroundColor: colors.border },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  statValueRow: { flexDirection: 'row', alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  statUnit: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  statIcon: { marginLeft: 4 },

  // Price band
  priceBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.greenLight,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceLabel: { fontSize: 14, color: colors.textSecondary, flexShrink: 1 },
  priceValue: { fontSize: 16, fontWeight: '800', color: colors.green },
  priceUnit: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  // Subsections
  subSection: { paddingHorizontal: 22, paddingVertical: 18, borderTopWidth: 1, borderTopColor: colors.border },
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  subTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoThumb: { width: 168, height: 168, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.bgChip, borderWidth: 1, borderColor: colors.border },
  photoImg: { width: '100%', height: '100%' },

  // Detail rows
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
  detailLabel: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  detailValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, textAlign: 'right', flexShrink: 1 },
  description: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },

  // Reservation history
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  logDot: { fontSize: 16, color: colors.textMuted, lineHeight: 18 },
  logBody: { flex: 1, minWidth: 0 },
  logText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  logTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Activity
  activityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  activityLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderDark },
  activityLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flexShrink: 1 },
  activityDate: { fontSize: 12, color: colors.textMuted },

  // Documents
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

  // Delete button
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 18,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: colors.redLight,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: colors.red },

  // ⋯ overflow sheet
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  menuItem: { paddingVertical: 16, paddingHorizontal: 8, borderRadius: 10 },
  menuItemPressed: { backgroundColor: colors.bgPage },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },

  // Delete confirmation modal
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 9999 },
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
