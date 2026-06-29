import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../navigation';
import {
  acceptReservation,
  getIncomingReservations,
  getMyReservations,
  rejectReservation,
  type IncomingReservation,
  type OutgoingReservation,
} from '../services/supabase/reservations';
import { EmptyState } from '../components/shared/EmptyState';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { ReservationCard } from '../components/reservations/ReservationCard';
import { NegotiationModal } from '../components/reservations/NegotiationModal';
import { webOnly } from '../components/layout/web';
import { toast } from '../stores/toast';
import { colors, radius, shadows } from '../theme/tokens';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Reservations'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Tab = 'received' | 'sent';

/** Status filter options (null = All). */
const STATUS_FILTERS: ReadonlyArray<{ label: string; value: string | null }> = [
  { label: 'All Status', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'Negotiating', value: 'negotiating' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Passed', value: 'passed' },
];

export function ReservationsScreen({ navigation }: Props): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('received');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // The reservation whose negotiation popup is open (over the hub — no navigation).
  const [selected, setSelected] = useState<{ side: 'incoming' | 'outgoing'; data: IncomingReservation } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const incomingQuery = useQuery({ queryKey: ['reservations', 'incoming'], queryFn: getIncomingReservations, staleTime: 20_000 });
  const outgoingQuery = useQuery({ queryKey: ['reservations', 'outgoing'], queryFn: getMyReservations, staleTime: 20_000 });

  // Inline Confirm / Reject straight from a received card (no modal needed).
  const settle = (): void => {
    setBusyId(null);
    void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };
  const acceptMutation = useMutation({
    mutationFn: acceptReservation,
    onSuccess: () => toast.success('Reservation accepted!'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not confirm.'),
    onSettled: settle,
  });
  const rejectMutation = useMutation({
    mutationFn: rejectReservation,
    onSuccess: () => toast.success('Reservation rejected'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not reject.'),
    onSettled: settle,
  });

  useFocusEffect(
    React.useCallback(() => {
      void incomingQuery.refetch();
      void outgoingQuery.refetch();
    }, [incomingQuery, outgoingQuery]),
  );

  const incoming = useMemo(
    () => (incomingQuery.data ?? []).filter((r) => statusFilter === null || r.status === statusFilter),
    [incomingQuery.data, statusFilter],
  );
  const outgoing = useMemo(
    () => (outgoingQuery.data ?? []).filter((r) => statusFilter === null || r.status === statusFilter),
    [outgoingQuery.data, statusFilter],
  );

  const openDetail = (side: 'incoming' | 'outgoing', item: IncomingReservation | OutgoingReservation): void => {
    const data: IncomingReservation =
      side === 'incoming'
        ? (item as IncomingReservation)
        : { ...(item as OutgoingReservation), is_middleman: false, passthrough_status: null };
    setSelected({ side, data });
  };

  const loading = incomingQuery.isLoading || outgoingQuery.isLoading;
  const list = tab === 'received' ? incoming : outgoing;

  return (
    <MainLayout active="reservations">
      <PageHeader title="Reservation Hub" subtitle="Manage your reservation requests and negotiations" />

      <PageBody>
        <View style={styles.container}>
          {/* Status filter */}
          <View style={styles.filterRow}>
            <StatusSelect value={statusFilter} onChange={setStatusFilter} />
          </View>

          {/* Tabs — segmented pill control */}
          <View style={styles.tabs}>
            <TabButton
              label="Received"
              icon="arrow-down"
              count={incoming.length}
              active={tab === 'received'}
              onPress={() => setTab('received')}
              testID="reservations-tab-received"
            />
            <TabButton
              label="Sent"
              icon="arrow-up"
              count={outgoing.length}
              active={tab === 'sent'}
              onPress={() => setTab('sent')}
              testID="reservations-tab-sent"
            />
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          ) : list.length === 0 ? (
            tab === 'received' ? (
              <EmptyState
                icon="🤝"
                title={statusFilter ? 'No matching requests' : 'No incoming requests'}
                message={
                  statusFilter
                    ? 'Try a different status filter.'
                    : "Reservations on items you've shared will appear here."
                }
                testID="reservations-empty-received"
              />
            ) : (
              <EmptyState
                icon="🤝"
                title={statusFilter ? 'No matching reservations' : 'No reservations yet'}
                message={
                  statusFilter
                    ? 'Try a different status filter.'
                    : "Reserve items shared with you and they'll show up here to track."
                }
                ctaLabel={statusFilter ? undefined : 'Browse Received'}
                onCta={statusFilter ? undefined : () => navigation.navigate('Received')}
                testID="reservations-empty-sent"
              />
            )
          ) : (
            list.map((item) => (
              <ReservationCard
                key={item.reservation_id}
                item={item}
                side={tab}
                busy={busyId === item.reservation_id}
                onOpen={() => openDetail(tab === 'received' ? 'incoming' : 'outgoing', item)}
                onConfirm={() => {
                  setBusyId(item.reservation_id);
                  acceptMutation.mutate(item.reservation_id);
                }}
                onReject={() => {
                  setBusyId(item.reservation_id);
                  rejectMutation.mutate(item.reservation_id);
                }}
              />
            ))
          )}
        </View>
      </PageBody>

      {/* Negotiation popup — opens over the hub from a reservation card. */}
      {selected ? (
        <NegotiationModal
          visible
          side={selected.side}
          data={selected.data}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </MainLayout>
  );
}

/** Segmented pill tab with a leading arrow icon and a count, e.g. "↓ Received (7)". */
function TabButton({
  label,
  icon,
  count,
  active,
  onPress,
  testID,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  count: number;
  active: boolean;
  onPress: () => void;
  testID: string;
}): React.JSX.Element {
  return (
    <Pressable style={[styles.tab, active ? styles.tabActive : null]} onPress={onPress} testID={testID}>
      <Ionicons name={icon} size={14} color={active ? colors.textPrimary : colors.textMuted} />
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
        {label} ({count})
      </Text>
    </Pressable>
  );
}

/** Left-aligned 'All Status' dropdown. */
function StatusSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const label = STATUS_FILTERS.find((f) => f.value === value)?.label ?? 'All Status';

  return (
    <View style={styles.selectWrap}>
      <Pressable style={styles.select} onPress={() => setOpen((o) => !o)} testID="reservations-status-filter">
        <Text style={styles.selectText}>{label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.dropdown}>
          {STATUS_FILTERS.map((f) => {
            const active = f.value === value;
            return (
              <Pressable
                key={f.label}
                style={styles.option}
                onPress={() => {
                  onChange(f.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 860, alignSelf: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },

  // Status filter (left-aligned)
  filterRow: { flexDirection: 'row', marginBottom: 14, zIndex: 30 },
  selectWrap: { position: 'relative', zIndex: 1000 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999, // round-bordered pill
    backgroundColor: colors.bgWhite,
    ...webOnly({ cursor: 'pointer' }),
  },
  selectText: { fontSize: 13, color: colors.textPrimary },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    minWidth: 180,
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border, // #E2E8F0
    borderRadius: radius.md, // 10
    paddingVertical: 4,
    overflow: 'visible',
    zIndex: 9999,
    ...shadows.dropdown,
  },
  option: { paddingVertical: 9, paddingHorizontal: 12 },
  optionText: { fontSize: 13, color: colors.textSecondary },
  optionTextActive: { color: colors.accent, fontWeight: '600' },

  // Tabs — segmented pill control
  tabs: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 4,
    padding: 4,
    backgroundColor: colors.bgChip, // #F1F5F9
    borderRadius: 999,
    marginBottom: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    ...webOnly({ cursor: 'pointer' }),
  },
  tabActive: {
    backgroundColor: colors.bgWhite,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.textPrimary, fontWeight: '700' },
});
