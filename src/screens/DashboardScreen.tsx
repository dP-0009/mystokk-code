import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../navigation';
import { getDashboardData, type ReceivedItem } from '../services/supabase/dashboard';
import {
  acceptConnection,
  getPendingConnections,
  rejectConnection,
  type PendingConnection,
} from '../services/supabase/network';
import type { ColorValue } from '../theme/tokens';
import { colors, radius } from '../theme/tokens';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { AddVendorModal } from '../components/network/AddVendorModal';
import { useIsMobile } from '../hooks/useIsMobile';
import { webOnly } from '../components/layout/web';
import { ProductImage } from '../components/shared/ProductImage';
import { toast } from '../stores/toast';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Dashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;

const DASHBOARD_KEY = ['dashboard'] as const;

export function DashboardScreen({ navigation }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addVendorOpen, setAddVendorOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: getDashboardData,
    staleTime: 60_000, // don't refetch on every tab switch
  });

  // Pending incoming connection requests (status='pending', receiver = me).
  // Shares the Network screen's cache so accept/decline stay in sync.
  const { data: pendingData } = useQuery({
    queryKey: ['network', 'pending'],
    queryFn: getPendingConnections,
    staleTime: 60_000,
  });
  const pending = pendingData ?? [];

  const onConnectionSettled = (): void => {
    setBusyId(null);
    void queryClient.invalidateQueries({ queryKey: ['network'] });
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
  };

  const acceptMutation = useMutation({
    mutationFn: acceptConnection,
    onSuccess: () => toast.success('Connection accepted!'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not accept request.'),
    onSettled: onConnectionSettled,
  });
  const declineMutation = useMutation({
    mutationFn: rejectConnection,
    onSuccess: () => toast.info('Request declined'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not decline request.'),
    onSettled: onConnectionSettled,
  });

  return (
    <MainLayout active="dashboard">
      {/* On mobile the top app bar already shows the identity, so the page-title
          header is omitted (matches the mobile dashboard design). */}
      {isMobile ? null : (
        <PageHeader title="Dashboard" subtitle="Overview of your trading activity" />
      )}

      <PageBody>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : isError || !data ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Failed to load.'}
            </Text>
            <Pressable onPress={() => void refetch()} style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Overview — four tappable tiles (incl. Vendors) */}
            <Text style={styles.sectionLabel}>Overview</Text>
            <View style={[styles.tileGrid, isMobile ? styles.tileGridMobile : null]}>
              <OverviewTile
                label="My Inventory"
                value={data.stats.inventory}
                icon="cube"
                color={colors.accent}
                bg={colors.accentMid}
                mobile={isMobile}
                onPress={() => navigation.navigate('Inventory')}
              />
              <OverviewTile
                label="Received"
                value={data.stats.received}
                icon="file-tray"
                color={colors.green}
                bg={colors.greenLight}
                mobile={isMobile}
                onPress={() => navigation.navigate('Received')}
              />
              <OverviewTile
                label="Reservations"
                value={data.stats.reservations}
                icon="bookmark"
                color={colors.purple}
                bg={colors.purpleLight}
                mobile={isMobile}
                onPress={() => navigation.navigate('Reservations')}
              />
              <OverviewTile
                label="Vendors"
                value={data.stats.network}
                icon="people"
                color={colors.orange}
                bg={colors.orangeLight}
                mobile={isMobile}
                onPress={() => navigation.navigate('Network')}
              />
            </View>

            {/* Quick Actions — Add Inventory + Add Vendor */}
            <Text style={styles.sectionLabel}>Quick Actions</Text>
            <View style={styles.quickRow}>
              <QuickAction
                label="Add Inventory"
                icon="add"
                color={colors.accent}
                bg={colors.accentMid}
                onPress={() => navigation.navigate('InventoryCreate')}
              />
              <QuickAction
                label="Add Vendor"
                icon="person-add"
                color={colors.green}
                bg={colors.greenLight}
                onPress={() => setAddVendorOpen(true)}
              />
            </View>

            {/* Team Invitation cards — one per incoming connection request */}
            {pending.length > 0 ? (
              <View style={styles.pendingSection}>
                {pending.map((p) => (
                  <PendingRequestCard
                    key={p.connection_id}
                    item={p}
                    busy={busyId === p.connection_id}
                    onAccept={() => {
                      setBusyId(p.connection_id);
                      acceptMutation.mutate(p.connection_id);
                    }}
                    onDecline={() => {
                      setBusyId(p.connection_id);
                      declineMutation.mutate(p.connection_id);
                    }}
                  />
                ))}
              </View>
            ) : null}

            {/* Recently Shared With You */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Shared With You</Text>
              <Text style={styles.viewAll} onPress={() => navigation.navigate('Received')}>
                View All →
              </Text>
            </View>

            {data.received.length === 0 ? (
              <Text style={styles.empty}>Nothing has been shared with you yet.</Text>
            ) : (
              <View style={styles.list}>
                {data.received.map((item) => (
                  <ReceivedRow
                    key={item.share_id}
                    item={item}
                    onPress={() => navigation.navigate('ReceivedDetail', { shareId: item.share_id })}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </PageBody>

      <AddVendorModal visible={addVendorOpen} onClose={() => setAddVendorOpen(false)} />
    </MainLayout>
  );
}

/**
 * "Team Invitation" card for an incoming connection request: a blue-tinted
 * panel with a person-add icon + heading, and an inner white row showing the
 * inviting company, its role, and Decline / Accept actions.
 */
function PendingRequestCard({
  item,
  busy,
  onAccept,
  onDecline,
}: {
  item: PendingConnection;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}): React.JSX.Element {
  const name = item.company_name ?? item.contact_person ?? 'A vendor';
  return (
    <View style={styles.inviteCard}>
      {/* Header — icon + title/subtitle */}
      <View style={styles.inviteHeader}>
        <View style={styles.inviteIcon}>
          <Ionicons name="person-add" size={20} color={colors.accent} />
        </View>
        <View style={styles.inviteHeaderText}>
          <Text style={styles.inviteTitle}>Team Invitation</Text>
          <Text style={styles.inviteSubtitle}>You&apos;ve been invited to join a team</Text>
        </View>
      </View>

      {/* Inner white row — company + role, Decline / Accept */}
      <View style={styles.inviteRow}>
        <View style={styles.inviteRowInfo}>
          <Text style={styles.inviteCompany} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.inviteRole}>Role: Full Access</Text>
        </View>
        <View style={styles.inviteActions}>
          <Pressable
            style={[styles.declineBtn, busy ? styles.btnDisabled : null]}
            onPress={onDecline}
            disabled={busy}
            testID={`pending-decline-${item.connection_id}`}
          >
            <Ionicons name="close" size={15} color={colors.red} />
            <Text style={styles.declineBtnText}>Decline</Text>
          </Pressable>
          <Pressable
            style={[styles.acceptBtn, busy ? styles.btnDisabled : null]}
            onPress={onAccept}
            disabled={busy}
            testID={`pending-accept-${item.connection_id}`}
          >
            <Ionicons name="checkmark" size={15} color={colors.bgWhite} />
            <Text style={styles.acceptBtnText}>Accept</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** A single "Recently Shared With You" row (mirror `.rc2`). */
function ReceivedRow({
  item,
  onPress,
}: {
  item: ReceivedItem;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <ProductImage
        uri={item.thumbUrl}
        width={56}
        height={56}
        borderRadius={radius.md}
        fallback={<Ionicons name="cube-outline" size={24} color={colors.textMuted} />}
      />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.sharedByLabel}>Shared by</Text>
        <Text style={styles.sharedByName} numberOfLines={2}>
          {item.shared_by_company_name ?? 'A vendor'}
        </Text>
      </View>
    </Pressable>
  );
}

/** A tappable Overview tile: tinted icon square, big value, label. */
function OverviewTile({
  label,
  value,
  icon,
  color,
  bg,
  mobile,
  onPress,
}: {
  label: string;
  value: number;
  icon: IoniconName;
  color: ColorValue;
  bg: ColorValue;
  mobile: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={[styles.tile, mobile ? styles.tileMobile : styles.tileDesktop, webOnly({ cursor: 'pointer' })]}
      onPress={onPress}
    >
      <View style={[styles.tileIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

/** A Quick Action card: round tinted icon + label. */
function QuickAction({
  label,
  icon,
  color,
  bg,
  onPress,
}: {
  label: string;
  icon: IoniconName;
  color: ColorValue;
  bg: ColorValue;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable style={[styles.quickCard, webOnly({ cursor: 'pointer' })]} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },

  // Section labels (mirror "OVERVIEW" / "QUICK ACTIONS")
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 4,
  },

  // Overview tiles
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  tileGridMobile: { gap: 12 },
  tile: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 8,
  },
  tileDesktop: { flexGrow: 1, flexBasis: 0, minWidth: 170 },
  tileMobile: { flexGrow: 1, flexBasis: '46%', minWidth: 140 },
  tileIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  tileLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  // Quick Actions
  quickRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  quickCard: {
    flex: 1,
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
  },
  quickIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },

  errorText: { color: colors.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  retry: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: radius.md },
  retryText: { color: colors.bgWhite, fontWeight: '700' },

  // Body action row — right-aligned, lines up under the fixed bell icon.
  actionRow: { alignItems: 'flex-end', marginBottom: 16 },
  // `.btn-p` — dark navy primary button.
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  addBtnText: { color: colors.bgWhite, fontSize: 13, fontWeight: '600' },

  // `.stat-grid`
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 28 },

  // Team Invitation section
  pendingSection: { marginBottom: 18, gap: 16 },
  // Blue-tinted outer panel.
  inviteCard: {
    backgroundColor: colors.accentLight, // #EFF6FF
    borderWidth: 1,
    borderColor: colors.accentMid, // #DBEAFE
    borderRadius: 16,
    padding: 20,
  },
  inviteHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  // Rounded-square icon tile.
  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accentMid, // #DBEAFE
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inviteHeaderText: { flex: 1, minWidth: 0 },
  inviteTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  inviteSubtitle: { fontSize: 13, color: colors.accent, marginTop: 2 },
  // Inner white row.
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.bgWhite,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  inviteRowInfo: { flex: 1, minWidth: 0 },
  inviteCompany: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  inviteRole: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  inviteActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    ...webOnly({ cursor: 'pointer' }),
  },
  acceptBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border, // #E2E8F0
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    ...webOnly({ cursor: 'pointer' }),
  },
  declineBtnText: { color: colors.red, fontSize: 13, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  viewAll: { fontSize: 13, fontWeight: '600', color: colors.accent },

  list: { gap: 10 },
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: 8 },

  // `.rc2`
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  // `.ith`
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.bgChip,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowRight: { alignItems: 'flex-end', flexShrink: 0, maxWidth: 200 },
  sharedByLabel: { fontSize: 11, color: colors.textMuted },
  sharedByName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' },
});
