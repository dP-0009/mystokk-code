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
import { colors, radius } from '../theme/tokens';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { StatCard } from '../components/dashboard/StatCard';
import { webOnly } from '../components/layout/web';
import { toast } from '../stores/toast';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Dashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;

const DASHBOARD_KEY = ['dashboard'] as const;

function money(currency: string | null, price: number | null): string {
  if (price === null || price === undefined) return 'N/A';
  return `${currency ?? ''} ${price}`.trim();
}

/** First alphanumeric character of a name, uppercased (avatar initial). */
function initial(name: string): string {
  return (name.trim().match(/[a-z0-9]/i)?.[0] ?? '?').toUpperCase();
}

/** "Sent 5 minutes ago" / "Sent 3 hours ago" / "Sent 2 days ago". */
function sentAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'Sent just now';
  if (min < 60) return `Sent ${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Sent ${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  return `Sent ${day} day${day === 1 ? '' : 's'} ago`;
}

export function DashboardScreen({ navigation }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

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
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your trading activity"
      />

      <PageBody>
        {/* Right-aligned action, sitting directly below the fixed bell icon. */}
        <View style={styles.actionRow}>
          <Pressable style={styles.addBtn} onPress={() => navigation.navigate('InventoryCreate')}>
            <Ionicons name="add" size={16} color={colors.bgWhite} />
            <Text style={styles.addBtnText}>Add Inventory</Text>
          </Pressable>
        </View>

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
            {/* Stat cards */}
            <View style={styles.statGrid}>
              <StatCard
                label="My Inventory"
                value={data.stats.inventory}
                sub="In your catalog"
                icon="cube"
                iconColor={colors.accent}
                iconBg={colors.accentMid}
                onPress={() => navigation.navigate('Inventory')}
              />
              <StatCard
                label="Received Items"
                value={data.stats.received}
                sub="Shared with you"
                icon="file-tray"
                iconColor={colors.green}
                iconBg={colors.greenLight}
                onPress={() => navigation.navigate('Received')}
              />
              <StatCard
                // Closest available metric is the reservation/negotiation count.
                label="Conversations"
                value={data.stats.reservations}
                sub="Active threads"
                icon="chatbubble-ellipses"
                iconColor={colors.purple}
                iconBg={colors.purpleLight}
                onPress={() => navigation.navigate('Reservations')}
              />
              <StatCard
                label="My Network"
                value={data.stats.network}
                sub="Connected vendors"
                icon="people"
                iconColor={colors.orange}
                iconBg={colors.orangeLight}
                onPress={() => navigation.navigate('Network')}
              />
            </View>

            {/* Pending Requests — only when there are incoming requests */}
            {pending.length > 0 ? (
              <View style={styles.pendingSection}>
                <Text style={styles.pendingHeader}>Pending Requests</Text>
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
    </MainLayout>
  );
}

/** An incoming connection request card with Accept / Decline actions. */
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
    <View style={styles.pendingCard}>
      <View style={styles.pendingAvatar}>
        <Text style={styles.pendingAvatarText}>{initial(name)}</Text>
      </View>
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingTitle} numberOfLines={2}>
          {name} wants to connect with you
        </Text>
        <Text style={styles.pendingSub}>{sentAgo(item.created_at)}</Text>
      </View>
      <View style={styles.pendingActions}>
        <Pressable
          style={[styles.acceptBtn, busy ? styles.btnDisabled : null]}
          onPress={onAccept}
          disabled={busy}
          testID={`pending-accept-${item.connection_id}`}
        >
          <Text style={styles.acceptBtnText}>Accept</Text>
        </Pressable>
        <Pressable
          style={[styles.declineBtn, busy ? styles.btnDisabled : null]}
          onPress={onDecline}
          disabled={busy}
          testID={`pending-decline-${item.connection_id}`}
        >
          <Text style={styles.declineBtnText}>Decline</Text>
        </Pressable>
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
      <View style={styles.thumb}>
        <Ionicons name="cube-outline" size={24} color={colors.textMuted} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {/* Quantity/unit aren't in the get_received_shares RPC yet — show price. */}
        <Text style={styles.rowDetail} numberOfLines={1}>
          {money(item.display_currency, item.display_price)}
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

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
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

  // Pending Requests section
  pendingSection: { marginBottom: 18 },
  pendingHeader: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  pendingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pendingAvatarText: { color: '#1D4ED8', fontSize: 16, fontWeight: '700' },
  pendingInfo: { flex: 1, minWidth: 0 },
  pendingTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  pendingSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  pendingActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  acceptBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 16,
    ...webOnly({ cursor: 'pointer' }),
  },
  acceptBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  declineBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 16,
    ...webOnly({ cursor: 'pointer' }),
  },
  declineBtnText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
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
  rowDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  rowRight: { alignItems: 'flex-end', flexShrink: 0, maxWidth: 200 },
  sharedByLabel: { fontSize: 11, color: colors.textMuted },
  sharedByName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' },
});
