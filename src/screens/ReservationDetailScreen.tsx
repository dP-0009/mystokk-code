import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import {
  acceptReservation,
  cancelReservation,
  getNegotiationRounds,
  passToSupplier,
  rejectReservation,
  submitNegotiationRound,
  type NegotiationRound,
} from '../services/supabase/reservations';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { StatusChip } from '../components/shared/StatusChip';
import { AppButton } from '../components/shared/AppButton';
import { colors } from '../theme/tokens';
import { MystokkLoader } from '../components/shared/MystokkLoader';

type Props = NativeStackScreenProps<RootStackParamList, 'ReservationDetail'>;

const NUMERIC = /^\d*\.?\d*$/;
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

export function ReservationDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { side, data } = route.params;
  const queryClient = useQueryClient();
  const incoming = side === 'incoming';

  const [status, setStatus] = useState(data.status);
  const [negOpen, setNegOpen] = useState(false);
  const [negPrice, setNegPrice] = useState('');
  const [negQty, setNegQty] = useState(String(data.quantity));
  const [negMsg, setNegMsg] = useState('');

  const roundsQuery = useQuery({
    queryKey: ['negotiation', data.reservation_id],
    queryFn: () => getNegotiationRounds(data.reservation_id),
    staleTime: 15_000,
  });
  const rounds = roundsQuery.data ?? [];
  const myRoundsUsed = rounds.filter((r) => r.is_me).length;
  const lastRound = rounds[rounds.length - 1];
  const lastByMe = lastRound?.is_me ?? false;

  const actionable = status === 'pending' || status === 'negotiating';
  const canCounter = actionable && myRoundsUsed < MAX_ROUNDS && (status === 'negotiating' || incoming);
  const canAccept = actionable && (status === 'pending' ? incoming : !lastByMe);
  const canReject = incoming && actionable;
  const canCancel = !incoming && actionable;
  const canPass = incoming && actionable && data.is_middleman;

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };

  const leave = useMutation({
    mutationFn: async (kind: 'accept' | 'reject' | 'pass' | 'cancel') => {
      if (kind === 'accept') return acceptReservation(data.reservation_id);
      if (kind === 'reject') return rejectReservation(data.reservation_id);
      if (kind === 'pass') return passToSupplier(data.reservation_id);
      return cancelReservation(data.reservation_id);
    },
    onSuccess: () => {
      invalidate();
      navigation.goBack();
    },
    onError: (e) => Alert.alert('Action failed', e instanceof Error ? e.message : 'Try again.'),
  });

  const counter = useMutation({
    mutationFn: () =>
      submitNegotiationRound(data.reservation_id, Number(negPrice), Number(negQty || data.quantity), negMsg.trim() || null),
    onSuccess: () => {
      setNegOpen(false);
      setNegMsg('');
      setStatus('negotiating');
      void roundsQuery.refetch();
      invalidate();
    },
    onError: (e) => Alert.alert('Could not send counter', e instanceof Error ? e.message : 'Try again.'),
  });

  const confirm = (kind: 'reject' | 'cancel'): void => {
    const isReject = kind === 'reject';
    Alert.alert(
      isReject ? 'Reject reservation?' : 'Cancel reservation?',
      isReject ? 'The requester will be notified.' : 'This withdraws your request.',
      [
        { text: 'Back', style: 'cancel' },
        { text: isReject ? 'Reject' : 'Cancel it', style: 'destructive', onPress: () => leave.mutate(kind) },
      ],
    );
  };

  const nextRound = myRoundsUsed + 1;
  const remainingAfter = MAX_ROUNDS - nextRound;
  const roundHeader =
    myRoundsUsed >= MAX_ROUNDS
      ? "You've used all 3 negotiation rounds for this reservation."
      : `Round ${nextRound} of ${MAX_ROUNDS}${
          remainingAfter === 1
            ? ' — one more round available after this'
            : remainingAfter > 1
              ? ` — ${remainingAfter} more rounds available after this`
              : ' — final round'
        }`;

  const currentTerms = (): string => {
    if (lastRound) return `Latest counter: ${money(data.currency, lastRound.counter_price)} · Qty ${lastRound.counter_quantity?.toLocaleString() ?? data.quantity}`;
    if (data.offered_price != null) return `Offered ${money(data.currency, data.offered_price)} · Qty ${data.quantity.toLocaleString()}`;
    return `At listed price ${money(data.currency, data.list_price)} · Qty ${data.quantity.toLocaleString()}`;
  };

  return (
    <View style={styles.fill}>
      <ScreenHeader title="Reservation" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {/* Summary */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.thumb}>
              <Text style={styles.thumbIcon}>📦</Text>
            </View>
            <View style={styles.flexShrink}>
              <Text style={styles.title} numberOfLines={2}>
                {data.item_title}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {incoming ? 'From ' : 'To '}
                {data.counterparty_company ?? 'a vendor'}
              </Text>
            </View>
            <StatusChip status={status} />
          </View>
          <Text style={styles.terms}>{currentTerms()}</Text>
          {status === 'passed' ? (
            <View style={styles.passBanner}>
              <Text style={styles.passBannerText}>
                ⏳ Passed to supplier — {data.passthrough_status === 'confirmed' ? 'supplier confirmed' : data.passthrough_status === 'rejected' ? 'supplier declined' : 'awaiting their response'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Negotiation timeline */}
        <Text style={styles.sectionTitle}>Negotiation history</Text>
        {roundsQuery.isLoading ? (
          <View style={styles.loading}>
            <MystokkLoader size={48} />
          </View>
        ) : rounds.length === 0 ? (
          <Text style={styles.empty}>No counter-offers yet — this is the original request.</Text>
        ) : (
          <View style={styles.timeline}>
            {rounds.map((r: NegotiationRound, idx) => (
              <View key={`${r.proposed_by}-${r.round_number}-${idx}`} style={styles.roundRow}>
                <View style={styles.dotCol}>
                  <View style={[styles.dot, r.is_me ? styles.dotMe : styles.dotThem]} />
                  {idx < rounds.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={styles.roundBody}>
                  <Text style={styles.roundWho}>
                    {r.is_me ? 'You' : r.proposer_company ?? 'Them'}{' '}
                    <Text style={styles.roundTag}>· Round {r.round_number}</Text>
                  </Text>
                  <Text style={styles.roundTerms}>
                    {money(data.currency, r.counter_price)} · Qty {r.counter_quantity?.toLocaleString() ?? '—'}
                  </Text>
                  {r.message ? <Text style={styles.roundMsg}>“{r.message}”</Text> : null}
                  <Text style={styles.roundTime}>{when(r.created_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Actions */}
      {actionable ? (
        <View style={styles.actionsBar}>
          {canAccept ? (
            <AppButton
              title={lastRound ? 'Accept latest' : 'Accept'}
              style={styles.flex1}
              loading={leave.isPending && leave.variables === 'accept'}
              onPress={() => leave.mutate('accept')}
            />
          ) : null}
          {canCounter ? (
            <AppButton title="Counter" variant="outline" style={styles.flex1} onPress={() => setNegOpen(true)} />
          ) : null}
          {canReject ? (
            <Pressable style={styles.iconBtn} onPress={() => confirm('reject')}>
              <Text style={styles.iconBtnText}>Reject</Text>
            </Pressable>
          ) : null}
          {canCancel ? (
            <Pressable style={styles.iconBtn} onPress={() => confirm('cancel')}>
              <Text style={styles.iconBtnText}>Cancel</Text>
            </Pressable>
          ) : null}
          {canPass ? (
            <Pressable style={styles.passBtn} onPress={() => leave.mutate('pass')}>
              <Text style={styles.passText}>Pass to Supplier</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Counter sheet */}
      <Modal visible={negOpen} transparent animationType="slide" onRequestClose={() => setNegOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setNegOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Counter Offer</Text>
            <View style={styles.sheetBody}>
              <View style={[styles.roundInfo, myRoundsUsed >= MAX_ROUNDS ? styles.roundInfoBlocked : null]}>
                <Text style={[styles.roundText, myRoundsUsed >= MAX_ROUNDS ? styles.roundTextBlocked : null]}>{roundHeader}</Text>
              </View>
              <Text style={styles.fieldLabel}>Counter Quantity</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={negQty}
                onChangeText={(t) => NUMERIC.test(t) && setNegQty(t)}
                placeholder="0"
                placeholderTextColor={colors.slate400}
              />
              <Text style={styles.fieldLabel}>Counter Price</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={negPrice}
                onChangeText={(t) => NUMERIC.test(t) && setNegPrice(t)}
                placeholder="0.00"
                placeholderTextColor={colors.slate400}
              />
              <Text style={styles.fieldLabel}>Message</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={negMsg}
                onChangeText={setNegMsg}
                placeholder="Explain your counter…"
                placeholderTextColor={colors.slate400}
                multiline
              />
              <AppButton
                title="Send Counter Offer"
                onPress={() => counter.mutate()}
                loading={counter.isPending}
                disabled={myRoundsUsed >= MAX_ROUNDS || !negPrice || !NUMERIC.test(negPrice)}
                style={styles.sheetBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  body: { padding: 16, paddingBottom: 24 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.slate100 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { fontSize: 22 },
  flexShrink: { flexShrink: 1, flex: 1 },
  title: { fontSize: 15, fontWeight: '800', color: colors.slate900 },
  sub: { fontSize: 12, color: colors.slate500, marginTop: 2 },
  terms: { fontSize: 13, fontWeight: '700', color: colors.emerald, marginTop: 12 },
  passBanner: { marginTop: 12, backgroundColor: colors.slate100, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  passBannerText: { fontSize: 12, fontWeight: '600', color: colors.slate700 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.slate900, marginTop: 22, marginBottom: 12 },
  loading: { marginTop: 10 },
  empty: { fontSize: 13, color: colors.slate400 },

  timeline: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.slate100 },
  roundRow: { flexDirection: 'row', gap: 12 },
  dotCol: { alignItems: 'center', width: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  dotMe: { backgroundColor: colors.emerald },
  dotThem: { backgroundColor: colors.blue },
  line: { width: 2, flex: 1, backgroundColor: colors.slate200, marginVertical: 2 },
  roundBody: { flex: 1, paddingBottom: 16 },
  roundWho: { fontSize: 13, fontWeight: '700', color: colors.slate900 },
  roundTag: { fontSize: 12, fontWeight: '600', color: colors.slate400 },
  roundTerms: { fontSize: 13, color: colors.slate700, marginTop: 2, fontWeight: '600' },
  roundMsg: { fontSize: 12.5, color: colors.slate500, marginTop: 4, fontStyle: 'italic' },
  roundTime: { fontSize: 11, color: colors.slate400, marginTop: 4 },

  actionsBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: colors.slate100 },
  flex1: { flex: 1, minWidth: 120 },
  iconBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.redBg, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { color: colors.red, fontWeight: '700', fontSize: 14 },
  passBtn: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  passText: { color: colors.slate700, fontWeight: '700', fontSize: 14 },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.slate200, alignSelf: 'center', marginTop: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: colors.slate900, textAlign: 'center', marginTop: 10 },
  sheetBody: { paddingHorizontal: 18, paddingTop: 14 },
  roundInfo: { backgroundColor: colors.amberBg, borderRadius: 10, padding: 10, marginBottom: 14 },
  roundInfoBlocked: { backgroundColor: colors.redBg },
  roundText: { fontSize: 12, color: colors.amber, fontWeight: '600' },
  roundTextBlocked: { color: colors.red },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: colors.slate200, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.slate900, marginBottom: 6 },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  sheetBtn: { marginTop: 14 },
});
