import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
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
import {
  Badge,
  EmptyState,
  GlassPanel,
  Icon,
  NavButton,
  ScreenBackground,
  SegmentedControl,
  Sheet,
  SheetAction,
  TabHeader,
  Thumb,
  colors,
  glass,
  radii,
  spacing,
  useTabBarSpace,
  type BadgeTone,
} from '../components/mobile';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Reservations'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Tab = 'received' | 'sent';

/** Status filter options (prompt: All/Pending/Confirmed/Rejected/Cancelled). */
const STATUS_FILTERS: ReadonlyArray<{ label: string; value: string | null }> = [
  { label: 'All', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Cancelled', value: 'cancelled' },
];

function statusBadge(status: string): { label: string; tone: BadgeTone } {
  switch (status) {
    case 'pending':
      return { label: 'Pending', tone: 'amber' };
    case 'negotiating':
      return { label: 'Negotiating', tone: 'amber' };
    case 'confirmed':
      return { label: 'Confirmed', tone: 'green' };
    case 'rejected':
      return { label: 'Rejected', tone: 'red' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'gray' };
    case 'passed':
      return { label: 'Passed', tone: 'gray' };
    default:
      return { label: status, tone: 'gray' };
  }
}

function money(currency: string | null, price: number | null): string {
  if (price === null || price === undefined) return '—';
  return `${currency ?? ''} ${price.toLocaleString()}`.trim();
}

/** Reservation Hub (prototype SCREENS.reserve). Bound to the existing list queries. */
export function ReservationsScreen({ navigation }: Props): React.JSX.Element {
  const bottomPad = useTabBarSpace();
  const [tab, setTab] = React.useState<Tab>('received');
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const incomingQuery = useQuery({ queryKey: ['reservations', 'incoming'], queryFn: getIncomingReservations, staleTime: 20_000 });
  const outgoingQuery = useQuery({ queryKey: ['reservations', 'outgoing'], queryFn: getMyReservations, staleTime: 20_000 });

  useFocusEffect(
    React.useCallback(() => {
      void incomingQuery.refetch();
      void outgoingQuery.refetch();
    }, [incomingQuery, outgoingQuery]),
  );

  const filterList = <T extends IncomingReservation | OutgoingReservation>(rows: T[]): T[] => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (statusFilter === null || r.status === statusFilter) &&
        (q === '' || [r.item_title, r.counterparty_company].some((f) => f?.toLowerCase().includes(q))),
    );
  };

  const incoming = filterList(incomingQuery.data ?? []);
  const outgoing = filterList(outgoingQuery.data ?? []);
  const loading = incomingQuery.isLoading || outgoingQuery.isLoading;
  const refetching = incomingQuery.isRefetching || outgoingQuery.isRefetching;
  const list = tab === 'received' ? incoming : outgoing;

  const openDetail = (item: IncomingReservation | OutgoingReservation): void => {
    const side: 'incoming' | 'outgoing' = tab === 'received' ? 'incoming' : 'outgoing';
    const data: IncomingReservation =
      side === 'incoming'
        ? (item as IncomingReservation)
        : { ...(item as OutgoingReservation), is_middleman: false, passthrough_status: null };
    navigation.navigate('ReservationDetail', { side, data });
  };

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.searchRow}>
        <GlassPanel effect="clear" radius={radii.row} fill={glass.fillInput} style={styles.searchPill}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search reservations…"
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            autoCorrect={false}
          />
        </GlassPanel>
        <NavButton icon="filter" size={45} onPress={() => setFilterOpen(true)} />
      </View>

      <SegmentedControl
        segments={[
          {
            key: 'received',
            label: `Received (${incoming.length})`,
            icon: <Icon name="down" size={14} color={tab === 'received' ? colors.navy : colors.muted} />,
          },
          {
            key: 'sent',
            label: `Sent (${outgoing.length})`,
            icon: <Icon name="up" size={14} color={tab === 'sent' ? colors.navy : colors.muted} />,
          },
        ]}
        value={tab}
        onChange={(k) => setTab(k as Tab)}
      />
    </View>
  );

  return (
    <ScreenBackground>
      <TabHeader title="Reservation Hub" subtitle="Manage your reservation requests and negotiations" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} size="large" />
        </View>
      ) : (
        <FlashList
          data={list}
          keyExtractor={(it) => it.reservation_id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          refreshing={refetching}
          onRefresh={() => {
            void incomingQuery.refetch();
            void outgoingQuery.refetch();
          }}
          ListEmptyComponent={
            <EmptyState
              icon="hand"
              title={statusFilter || search ? 'No matching reservations' : tab === 'received' ? 'No incoming requests' : 'No reservations yet'}
              message={
                statusFilter || search
                  ? 'Try a different filter or search.'
                  : tab === 'received'
                    ? "Reservations on items you've shared will appear here."
                    : "Reserve items shared with you and they'll show up here to track."
              }
            />
          }
          renderItem={({ item }) => <HubCard item={item} party={tab === 'received' ? (item.counterparty_company ?? 'A vendor') : 'You'} onPress={() => openDetail(item)} />}
        />
      )}

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter by status" description="Show reservations with status">
        {STATUS_FILTERS.map((f, i) => {
          const selected = f.value === statusFilter;
          return (
            <SheetAction
              key={f.label}
              icon={selected ? 'check' : 'cal'}
              label={f.label}
              last={i === STATUS_FILTERS.length - 1}
              onPress={() => {
                setStatusFilter(f.value);
                setFilterOpen(false);
              }}
              trailing={selected ? <Icon name="check" size={18} color={colors.blue} /> : undefined}
            />
          );
        })}
      </Sheet>
    </ScreenBackground>
  );
}

/** One reservation card (prototype SCREENS.reserve exact format). */
function HubCard({
  item,
  party,
  onPress,
}: {
  item: IncomingReservation | OutgoingReservation;
  party: string;
  onPress: () => void;
}): React.JSX.Element {
  const badge = statusBadge(item.status);
  const price = money(item.currency, item.offered_price ?? item.list_price);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <GlassPanel radius={radii.card} style={styles.card}>
        <View style={styles.cardRow}>
          {item.thumbUrl ? (
            <Image source={{ uri: item.thumbUrl }} style={styles.photo} />
          ) : (
            <Thumb name={item.item_title} size={92} radius={16} />
          )}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={2}>
              {item.item_title}
            </Text>
            <Text style={styles.requested}>
              <Text style={styles.party}>{party}</Text> requested
            </Text>
            <Text style={styles.terms}>
              {item.quantity.toLocaleString()} {item.unit} <Text style={styles.price}>@ {price}</Text>
            </Text>
            <View style={styles.bottom}>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
              <Badge label={badge.label} tone={badge.tone} />
            </View>
          </View>
        </View>
      </GlassPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerBlock: { paddingTop: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, height: 45, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  card: { padding: 14, marginTop: 12 },
  cardRow: { flexDirection: 'row', gap: 13 },
  photo: { width: 92, height: 92, borderRadius: 16, backgroundColor: colors.grayBg },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 16.5, fontWeight: '700', color: colors.navy, lineHeight: 21 },
  requested: { fontSize: 13.5, color: colors.muted, marginTop: 6 },
  party: { fontWeight: '800', color: colors.navy },
  terms: { fontSize: 14.5, fontWeight: '800', color: colors.navy, marginTop: 3 },
  price: { color: colors.green },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  date: { fontSize: 12.5, color: colors.muted },
  pressed: { transform: [{ scale: 0.99 }] },
});
