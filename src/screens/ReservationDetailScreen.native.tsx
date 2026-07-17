import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import {
  acceptReservation,
  getNegotiationRounds,
  rejectReservation,
  submitNegotiationRound,
  type IncomingReservation,
  type NegotiationRound,
} from '../services/supabase/reservations';
import { getInventoryDetail } from '../services/supabase/inventory';
import { getReceivedShareDetail } from '../services/supabase/received';
import { confirmAction } from '../utils/confirm';
import { toast } from '../stores/toast';
import { CounterSheet } from '../components/reservations/CounterSheet';
import {
  Badge,
  Bubble,
  Button,
  Card,
  Icon,
  InfoNote,
  KeyValue,
  NavBar,
  ScreenBackground,
  Thumb,
  colors,
  layout,
  spacing,
  type BadgeTone,
} from '../components/mobile';
import { MystokkLoader } from '../components/shared/MystokkLoader';

type Props = NativeStackScreenProps<RootStackParamList, 'ReservationDetail'>;

const MAX_ROUNDS = 3;

function money(currency: string | null, price: number | null): string {
  if (price === null || price === undefined) return '—';
  return `${currency ?? ''} ${price.toLocaleString()}`.trim();
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Reservation status → badge label + tone. */
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

/**
 * Negotiation detail (prototype SCREENS.negotiation / negotiationSent). Two
 * variants by direction:
 *   incoming (side='incoming') → you are the SELLER (Received request)
 *   outgoing (side='outgoing') → you are the BUYER (Sent request)
 * Bound to the existing negotiation history + accept/reject/counter mutations.
 */
export function ReservationDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { side, data } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const incoming = side === 'incoming';

  const [status, setStatus] = React.useState(data.status);
  const [counterOpen, setCounterOpen] = React.useState(false);

  const roundsQuery = useQuery({
    queryKey: ['negotiation', data.reservation_id],
    queryFn: () => getNegotiationRounds(data.reservation_id),
    staleTime: 15_000,
  });
  const rounds = roundsQuery.data ?? [];

  // The item's ORIGINAL listed quantity for the header row — from the existing
  // item query for whichever side owns the reference (seller = own inventory;
  // buyer = the received share). Price comes from the reservation's list_price.
  const invQuery = useQuery({
    queryKey: ['inventoryDetail', data.inventory_id],
    queryFn: () => getInventoryDetail(data.inventory_id),
    enabled: incoming,
    staleTime: 60_000,
  });
  const shareQuery = useQuery({
    queryKey: ['receivedDetail', data.share_id],
    queryFn: () => getReceivedShareDetail(data.share_id),
    enabled: !incoming,
    staleTime: 60_000,
  });
  const originalQty = incoming ? invQuery.data?.item.quantity : shareQuery.data?.quantity;

  const myRoundsUsed = rounds.filter((r) => r.is_me).length;
  const actionable = status === 'pending' || status === 'negotiating';
  const canCounter = actionable && myRoundsUsed < MAX_ROUNDS;

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };

  const leave = useMutation({
    mutationFn: (kind: 'accept' | 'reject') =>
      kind === 'accept' ? acceptReservation(data.reservation_id) : rejectReservation(data.reservation_id),
    onSuccess: (_r, kind) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(kind === 'accept' ? 'Reservation confirmed' : 'Reservation rejected');
      invalidate();
      navigation.goBack();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed.'),
  });

  const counter = useMutation({
    mutationFn: (vars: { price: number; qty: number; note: string | null }) =>
      submitNegotiationRound(data.reservation_id, vars.price, vars.qty, vars.note),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCounterOpen(false);
      setStatus('negotiating');
      void roundsQuery.refetch();
      invalidate();
      toast.success('Counter offer sent');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not send counter.'),
  });

  const confirmReject = (): void => {
    confirmAction({
      title: 'Reject reservation?',
      message: 'The requester will be notified.',
      confirmLabel: 'Reject',
      destructive: true,
      onConfirm: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        leave.mutate('reject');
      },
    });
  };

  const badge = statusBadge(status);
  const partyLabel = incoming ? 'Buyer' : 'Seller';
  const partyName = data.counterparty_company ?? 'a vendor';

  // The original REQUEST bubble (buyer's), then each counter round.
  const requestTerms = `${data.quantity.toLocaleString()} ${data.unit} @ ${money(data.currency, data.offered_price ?? data.list_price)}`;

  return (
    <ScreenBackground>
      <NavBar title={data.item_title} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + (incoming && actionable ? 120 : 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card — item + party (NO round count) + status badge. */}
        <Card style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Thumb name={data.item_title} size={46} radius={13} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {data.item_title}
              </Text>
              <Text style={styles.headerParty} numberOfLines={1}>
                {partyLabel}: {partyName}
              </Text>
            </View>
            <Badge label={badge.label} tone={badge.tone} />
          </View>
          <View style={styles.headerKv}>
            <KeyValue
              label="Original quantity"
              value={originalQty !== undefined ? `${originalQty.toLocaleString()} ${data.unit}` : '—'}
            />
            <KeyValue
              label="Original price"
              value={`${money(data.currency, data.list_price)}${data.list_price !== null ? ` / ${data.unit}` : ''}`}
              valueColor={colors.green}
              last
            />
          </View>
        </Card>

        <Text style={styles.section}>NOTES & MESSAGES</Text>

        {roundsQuery.isLoading ? (
          <View style={styles.loading}>
            <MystokkLoader size={48} />
          </View>
        ) : (
          <>
            {/* Original request bubble. */}
            <Bubble
              who={incoming ? partyName : 'You'}
              round="Request"
              headline={requestTerms}
              note={data.message ?? undefined}
              time={when(data.created_at)}
              mine={!incoming}
            />
            {/* Counter rounds. */}
            {rounds.map((r: NegotiationRound, idx) => (
              <Bubble
                key={`${r.proposed_by}-${r.round_number}-${idx}`}
                who={r.is_me ? 'You' : r.proposer_company ?? partyName}
                round={`Counter ${r.round_number}`}
                headline={`${money(data.currency, r.counter_price)} · ${r.counter_quantity?.toLocaleString() ?? data.quantity.toLocaleString()} ${data.unit}`}
                note={r.message ?? undefined}
                time={when(r.created_at)}
                mine={r.is_me}
              />
            ))}
          </>
        )}

        {/* SENT (buyer): waiting infonote for pending; NO action bar. */}
        {!incoming && actionable ? (
          <View style={styles.waiting}>
            <InfoNote icon="clock">
              Waiting for {partyName} to respond… You&apos;ll get a notification when they accept, reject, or counter.
            </InfoNote>
          </View>
        ) : null}

        {/* Closed-state banner. */}
        {!actionable ? (
          <View style={styles.waiting}>
            <InfoNote icon="clock">This reservation is {badge.label.toLowerCase()}.</InfoNote>
          </View>
        ) : null}
      </ScrollView>

      {/* RECEIVED (seller) pending: Reject / Counter / Accept. */}
      {incoming && actionable ? (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 20 }]}>
          <Button label="Reject" variant="danger" onPress={confirmReject} style={styles.actReject} />
          <Button
            label="Counter"
            variant="ghost"
            onPress={() => setCounterOpen(true)}
            disabled={!canCounter}
            style={styles.actCounter}
          />
          <Button
            label="Accept"
            variant="green"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              leave.mutate('accept');
            }}
            disabled={leave.isPending}
            style={styles.actAccept}
          />
        </View>
      ) : null}

      <CounterSheet
        visible={counterOpen}
        round={myRoundsUsed + 1}
        maxRounds={MAX_ROUNDS}
        currency={data.currency ?? 'AED'}
        unit={data.unit}
        defaultQty={data.quantity}
        submitting={counter.isPending}
        onClose={() => setCounterOpen(false)}
        onSubmit={(price, qty, note) => counter.mutate({ price, qty, note })}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter },
  loading: { marginTop: 20 },

  headerCard: { marginTop: 12, padding: 14, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  headerInfo: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 15.5, fontWeight: '700', color: colors.navy },
  headerParty: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  headerKv: {},

  section: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.7, color: colors.muted, marginTop: 22, marginBottom: 10 },

  waiting: { marginTop: 10 },

  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12,
  },
  actReject: { flex: 1 },
  actCounter: { flex: 1 },
  actAccept: { flex: 1.4 },
});
