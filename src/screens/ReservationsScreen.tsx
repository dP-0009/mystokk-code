import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../navigation';
import {
  getIncomingReservations,
  getMyReservations,
  type IncomingReservation,
  type OutgoingReservation,
} from '../services/supabase/reservations';
import { EmptyState } from '../components/shared/EmptyState';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { ReservationCard } from '../components/reservations/ReservationCard';
import { NegotiationModal } from '../components/reservations/NegotiationModal';
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
  { label: 'Passed', value: 'passed' },
];

export function ReservationsScreen({ navigation }: Props): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('received');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // The reservation whose negotiation popup is open (over the hub — no navigation).
  const [selected, setSelected] = useState<{ side: 'incoming' | 'outgoing'; data: IncomingReservation } | null>(null);

  const incomingQuery = useQuery({ queryKey: ['reservations', 'incoming'], queryFn: getIncomingReservations, staleTime: 20_000 });
  const outgoingQuery = useQuery({ queryKey: ['reservations', 'outgoing'], queryFn: getMyReservations, staleTime: 20_000 });

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

          {/* Tabs */}
          <View style={styles.tabs}>
            <TabButton
              label="Received"
              count={incoming.length}
              active={tab === 'received'}
              onPress={() => setTab('received')}
              testID="reservations-tab-received"
            />
            <TabButton
              label="Sent"
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
                onPress={() => openDetail(tab === 'received' ? 'incoming' : 'outgoing', item)}
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

/** Underline tab with a count badge (mirror the design's tab style). */
function TabButton({
  label,
  count,
  active,
  onPress,
  testID,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  testID: string;
}): React.JSX.Element {
  return (
    <Pressable style={[styles.tab, active ? styles.tabActive : null]} onPress={onPress} testID={testID}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
      <View style={[styles.tabBadge, active ? styles.tabBadgeActive : null]}>
        <Text style={[styles.tabBadgeText, active ? styles.tabBadgeTextActive : null]}>{count}</Text>
      </View>
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
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgWhite,
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

  // Tabs — underline style with count badge
  tabs: {
    flexDirection: 'row',
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: { borderBottomColor: colors.accent },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.accent },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.bgChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: { backgroundColor: colors.accentLight },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  tabBadgeTextActive: { color: colors.accent },
});
