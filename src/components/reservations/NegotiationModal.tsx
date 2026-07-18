import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BrandLoader } from '../shared/BrandLoader';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptReservation,
  cancelReservation,
  getNegotiationRounds,
  passToSupplier,
  rejectReservation,
  submitNegotiationRound,
  type IncomingReservation,
  type NegotiationRound,
} from '../../services/supabase/reservations';
import { StatusChip } from '../shared/StatusChip';
import { colors } from '../../theme/tokens';
import { webOnly } from '../layout/web';
import { toast } from '../../stores/toast';

const NUMERIC = /^\d*\.?\d*$/;
const MAX_ROUNDS = 3;

function money(currency: string | null, price: number | null | undefined): string {
  if (price === null || price === undefined) return '—';
  return `${currency ?? ''} ${price.toLocaleString()}`.trim();
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface NegotiationModalProps {
  visible: boolean;
  side: 'incoming' | 'outgoing';
  data: IncomingReservation;
  onClose: () => void;
}

/**
 * Reservation negotiation popup. Header (item + status), request info, a
 * chat-style thread of the original request and every counter (terms + note),
 * and turn-based actions.
 *
 * Turn rule: only the party whose turn it is to respond sees Accept / Counter /
 * Reject. The party who moved last sees just a "View Full History" button and a
 * waiting banner. Rounds are capped at 3 per side, and — because the buyer's
 * opening reservation is their round 1 — the buyer gets 2 counters while the
 * seller gets 3; the counter form warns on the final round.
 */
export function NegotiationModal({ visible, side, data, onClose }: NegotiationModalProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const incoming = side === 'incoming';
  const isRequester = !incoming; // the buyer who reserved views the 'outgoing' side

  const [status, setStatus] = useState(data.status);
  const [mode, setMode] = useState<'view' | 'counter'>('view');
  const [negPrice, setNegPrice] = useState('');
  const [negQty, setNegQty] = useState('');
  const [negNote, setNegNote] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const roundsQuery = useQuery({
    queryKey: ['negotiation', data.reservation_id],
    queryFn: () => getNegotiationRounds(data.reservation_id),
    staleTime: 15_000,
    enabled: visible,
  });
  const rounds = roundsQuery.data ?? [];
  const lastRound = rounds[rounds.length - 1];

  // Rounds the caller has consumed, counting the buyer's opening reservation.
  const myCounters = rounds.filter((r) => r.is_me).length;
  const myRoundsUsed = myCounters + (isRequester ? 1 : 0);
  const nextRoundNumber = myRoundsUsed + 1;
  const roundsExhausted = myRoundsUsed >= MAX_ROUNDS;
  const isFinalRound = nextRoundNumber === MAX_ROUNDS;

  // Whose turn is it? On a fresh request the buyer moved last (their reserve);
  // mid-negotiation it's whoever sent the latest counter.
  const lastMoveByMe = status === 'pending' ? isRequester : lastRound?.is_me ?? false;
  const actionable = status === 'pending' || status === 'negotiating';
  const myTurn = actionable && !lastMoveByMe;
  const waitingForReply = actionable && lastMoveByMe;

  const canAccept = myTurn;
  const canCounter = myTurn && !roundsExhausted;
  const canReject = myTurn && incoming;
  const canCancel = myTurn && !incoming;
  const canPass = myTurn && incoming && data.is_middleman;
  const otherParty = data.counterparty_company ?? 'the other party';

  // Reset transient UI each time the modal (re)opens for a reservation.
  React.useEffect(() => {
    if (visible) {
      setStatus(data.status);
      setMode('view');
      setNegPrice('');
      setNegQty('');
      setNegNote('');
      setHistoryOpen(false);
    }
  }, [visible, data.status, data.reservation_id]);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    void queryClient.invalidateQueries({ queryKey: ['reservationAttention'] });
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
    onSuccess: (_r, kind) => {
      invalidate();
      if (kind === 'accept') toast.success('Reservation accepted!');
      else if (kind === 'reject') toast.success('Reservation rejected');
      else if (kind === 'pass') toast.success('Passed to supplier');
      else toast.info('Reservation cancelled');
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed.'),
  });

  // The counter keeps the latest agreed quantity unless the user changes it.
  const baseQty = data.latest_counter_qty ?? data.quantity;
  const counter = useMutation({
    mutationFn: () =>
      submitNegotiationRound(
        data.reservation_id,
        Number(negPrice),
        Number(negQty || baseQty),
        negNote.trim() || null,
      ),
    onSuccess: () => {
      setMode('view');
      setNegPrice('');
      setNegQty('');
      setNegNote('');
      setStatus('negotiating');
      void roundsQuery.refetch();
      invalidate();
      toast.success('Counter offer sent!');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not send counter.'),
  });

  // Conversation thread: the opening request + every counter, each as a bubble
  // carrying its terms (price · qty) and any note.
  type Msg = {
    key: string;
    mine: boolean;
    sender: string;
    terms: string;
    note: string | null;
    tag: string;
    time: string;
  };
  const messages: Msg[] = [
    {
      key: 'request',
      mine: isRequester,
      sender: isRequester ? 'You' : data.counterparty_company ?? 'Buyer',
      terms: `${data.quantity.toLocaleString()} ${data.unit} @ ${money(data.currency, data.offered_price ?? data.list_price)}`,
      note: data.message,
      tag: 'Request',
      time: when(data.created_at),
    },
  ];
  rounds.forEach((r, i) => {
    messages.push({
      key: `round-${r.round_number}-${i}`,
      mine: r.is_me,
      sender: r.is_me ? 'You' : r.proposer_company ?? data.counterparty_company ?? 'Them',
      terms: `${money(data.currency, r.counter_price)} · ${r.counter_quantity?.toLocaleString() ?? data.quantity.toLocaleString()} ${data.unit}`,
      note: r.message,
      tag: `Counter ${r.round_number}`,
      time: when(r.created_at),
    });
  });

  const offeredDisplay = money(data.currency, data.offered_price ?? data.list_price);

  const historyButton = (
    <Pressable style={styles.footerHistoryBtn} onPress={() => setHistoryOpen(true)} testID="negotiation-history-footer">
      <Text style={styles.footerHistoryText}>View Full History</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          {/* Header — item name + status badge */}
          <View style={styles.header}>
            <Text style={styles.itemName} numberOfLines={2}>
              {data.item_title}
            </Text>
            <View style={styles.headerRight}>
              <StatusChip status={status} />
              <Pressable onPress={onClose} hitSlop={8} style={styles.close} testID="negotiation-close">
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* 1. Request info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Request</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{incoming ? 'Buyer' : 'Supplier'}</Text>
                <Text style={styles.infoValue}>{data.counterparty_company ?? 'A vendor'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Quantity</Text>
                <Text style={styles.infoValue}>
                  {data.quantity.toLocaleString()} {data.unit}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Offered price</Text>
                <Text style={styles.infoValuePrice}>{offeredDisplay}</Text>
              </View>
              <Pressable onPress={() => setHistoryOpen(true)} style={styles.historyBtn} testID="negotiation-history">
                <Text style={styles.historyBtnText}>View full history</Text>
              </Pressable>
            </View>

            {/* 2. Messages thread */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes & messages</Text>
              {roundsQuery.isLoading ? (
                <View style={styles.loading}>
                  <BrandLoader mode="loop" size={90} />
                </View>
              ) : (
                <View style={styles.thread}>
                  {messages.map((m) => (
                    <View key={m.key} style={[styles.bubbleRow, m.mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                      <View style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                        <View style={styles.bubbleHead}>
                          <Text style={styles.bubbleSender}>{m.sender}</Text>
                          <Text style={styles.bubbleTag}>{m.tag}</Text>
                        </View>
                        <Text style={styles.bubbleTerms}>{m.terms}</Text>
                        {m.note ? <Text style={styles.bubbleNote}>“{m.note}”</Text> : null}
                        <Text style={styles.bubbleTime}>{m.time}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Counter offer inline form */}
            {mode === 'counter' ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Counter offer</Text>
                <View style={[styles.roundInfo, isFinalRound ? styles.roundInfoFinal : null]}>
                  <Text style={[styles.roundInfoText, isFinalRound ? styles.roundInfoTextFinal : null]}>
                    {isFinalRound
                      ? '⚠ This is your last negotiation round — make it count.'
                      : `Round ${nextRoundNumber} of ${MAX_ROUNDS} · ${MAX_ROUNDS - nextRoundNumber} more after this`}
                  </Text>
                </View>
                <Text style={styles.fieldLabel}>Your Counter Price</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={negPrice}
                  onChangeText={(t) => NUMERIC.test(t) && setNegPrice(t)}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  testID="counter-price"
                />
                <Text style={styles.fieldLabel}>Counter Quantity</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={negQty}
                  onChangeText={(t) => NUMERIC.test(t) && setNegQty(t)}
                  placeholder={String(baseQty)}
                  placeholderTextColor={colors.textMuted}
                  testID="counter-qty"
                />
                <Text style={styles.fieldLabel}>Add a note (optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={negNote}
                  onChangeText={setNegNote}
                  placeholder="Add a note (optional)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                  testID="counter-note"
                />
                <View style={styles.counterActions}>
                  <Pressable style={styles.btnGhost} onPress={() => setMode('view')} testID="counter-cancel">
                    <Text style={styles.btnGhostText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnSend, !negPrice || !NUMERIC.test(negPrice) || counter.isPending ? styles.btnDisabled : null]}
                    disabled={!negPrice || !NUMERIC.test(negPrice) || counter.isPending}
                    onPress={() => counter.mutate()}
                    testID="counter-submit"
                  >
                    <Text style={styles.btnSendText}>Send Counter Offer</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* 3. Footer — status banner / waiting + history / turn-based actions */}
          {!actionable ? (
            <View style={styles.bannerWrap}>
              <View style={styles.banner}>
                <Text style={styles.bannerText}>
                  {status === 'confirmed'
                    ? 'This reservation was confirmed.'
                    : status === 'rejected'
                      ? 'This reservation was rejected.'
                      : status === 'cancelled'
                        ? 'This reservation was cancelled.'
                        : status === 'passed'
                          ? 'Passed to supplier — awaiting their response.'
                          : 'This reservation is closed.'}
                </Text>
              </View>
            </View>
          ) : waitingForReply && mode === 'view' ? (
            <View style={styles.waitingFooter}>
              <Text style={styles.bannerText}>Waiting for {otherParty} to respond…</Text>
              {historyButton}
            </View>
          ) : myTurn && mode === 'view' ? (
            <View style={styles.actions}>
              {canAccept ? (
                <Pressable
                  style={[styles.btn, styles.btnAccept]}
                  onPress={() => leave.mutate('accept')}
                  disabled={leave.isPending}
                  testID="negotiation-accept"
                >
                  <Text style={styles.btnAcceptText}>Accept</Text>
                </Pressable>
              ) : null}
              {canCounter ? (
                <Pressable
                  style={[styles.btn, styles.btnCounter]}
                  onPress={() => setMode('counter')}
                  testID="negotiation-counter"
                >
                  <Text style={styles.btnCounterText}>Counter Offer</Text>
                </Pressable>
              ) : null}
              {canReject ? (
                <Pressable
                  style={[styles.btn, styles.btnReject]}
                  onPress={() => leave.mutate('reject')}
                  disabled={leave.isPending}
                  testID="negotiation-reject"
                >
                  <Text style={styles.btnRejectText}>Reject</Text>
                </Pressable>
              ) : null}
              {canCancel ? (
                <Pressable
                  style={[styles.btn, styles.btnReject]}
                  onPress={() => leave.mutate('cancel')}
                  disabled={leave.isPending}
                  testID="negotiation-cancel"
                >
                  <Text style={styles.btnRejectText}>Cancel</Text>
                </Pressable>
              ) : null}
              {canPass ? (
                <Pressable
                  style={[styles.btn, styles.btnPass]}
                  onPress={() => leave.mutate('pass')}
                  disabled={leave.isPending}
                  testID="negotiation-pass"
                >
                  <Text style={styles.btnPassText}>Pass to Supplier</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* History sub-popup */}
          <HistoryModal
            visible={historyOpen}
            rounds={rounds}
            request={{
              company: data.counterparty_company,
              isRequester,
              terms: `${data.quantity.toLocaleString()} ${data.unit} @ ${money(data.currency, data.offered_price ?? data.list_price)}`,
              note: data.message,
              time: when(data.created_at),
            }}
            currency={data.currency}
            status={status}
            onClose={() => setHistoryOpen(false)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Full negotiation history — the opening request + round-by-round counters. */
function HistoryModal({
  visible,
  rounds,
  request,
  currency,
  status,
  onClose,
}: {
  visible: boolean;
  rounds: NegotiationRound[];
  request: { company: string | null; isRequester: boolean; terms: string; note: string | null; time: string };
  currency: string | null;
  status: string;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.itemName}>Negotiation history</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.historyScroll} contentContainerStyle={styles.scrollContent}>
            {/* The opening request is always the first entry. */}
            <View style={styles.histCard}>
              <View style={styles.histTop}>
                <Text style={styles.histRound}>Initial request</Text>
                <View style={styles.histBadge}>
                  <Text style={styles.histBadgeText}>requested</Text>
                </View>
              </View>
              <Text style={styles.histWho}>
                {request.isRequester ? 'You requested' : `${request.company ?? 'They'} requested`}
              </Text>
              <Text style={styles.histPrice}>{request.terms}</Text>
              {request.note ? <Text style={styles.histNote}>“{request.note}”</Text> : null}
              <Text style={styles.histTime}>{request.time}</Text>
            </View>

            {rounds.map((r, i) => {
              const isLast = i === rounds.length - 1;
              const outcome = isLast && status !== 'negotiating' && status !== 'pending' ? status : 'countered';
              return (
                <View key={`${r.round_number}-${i}`} style={styles.histCard}>
                  <View style={styles.histTop}>
                    <Text style={styles.histRound}>
                      {r.is_me ? 'You' : r.proposer_company ?? 'They'} · Counter {r.round_number}
                    </Text>
                    <View style={styles.histBadge}>
                      <Text style={styles.histBadgeText}>{outcome}</Text>
                    </View>
                  </View>
                  <Text style={styles.histPrice}>
                    {money(currency, r.counter_price)} · Qty {r.counter_quantity?.toLocaleString() ?? '—'}
                  </Text>
                  {r.message ? <Text style={styles.histNote}>“{r.message}”</Text> : null}
                  <Text style={styles.histTime}>{when(r.created_at)}</Text>
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: colors.bgWhite,
    borderRadius: 24,
    overflow: 'hidden',
    ...webOnly({ maxHeight: '90vh' }),
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  close: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgChip, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  closeText: { fontSize: 14, color: colors.textSecondary },

  scroll: { flexShrink: 1 },
  scrollContent: { padding: 20, gap: 20 },
  historyScroll: { flexShrink: 1, ...webOnly({ maxHeight: '60vh' }) },

  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },

  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  infoLabel: { fontSize: 13, color: colors.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  infoValuePrice: { fontSize: 13, fontWeight: '800', color: colors.green },
  historyBtn: { marginTop: 4, alignSelf: 'flex-start', ...webOnly({ cursor: 'pointer' }) },
  historyBtnText: { fontSize: 12, fontWeight: '700', color: colors.accent },

  loading: { marginVertical: 10, alignSelf: 'flex-start' },

  // Conversation thread
  thread: { gap: 10 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: colors.accentLight }, // #EFF6FF
  bubbleTheirs: { backgroundColor: colors.bgChip }, // #F1F5F9
  bubbleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 },
  bubbleSender: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  bubbleTag: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  bubbleTerms: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary },
  bubbleNote: { fontSize: 13, color: colors.textSecondary, marginTop: 3, fontStyle: 'italic' },
  bubbleTime: { fontSize: 10, color: colors.textMuted, marginTop: 5 },

  // Counter form
  roundInfo: { backgroundColor: colors.accentLight, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  roundInfoFinal: { backgroundColor: colors.redLight },
  roundInfoText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  roundInfoTextFinal: { color: colors.red },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, marginTop: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.bgWhite,
  },
  inputMultiline: { minHeight: 70 },
  counterActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  btnGhost: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border },
  btnGhostText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  btnSend: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', minWidth: 160 },
  btnSendText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },

  // Action area
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  // Grey status banner (closed reservations).
  bannerWrap: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border },
  banner: { backgroundColor: '#F1F5F9', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16 },
  bannerText: { fontSize: 13, color: '#64748B', textAlign: 'center', fontWeight: '600' },

  // Waiting footer — waiting text + the only available action (history).
  waitingFooter: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  footerHistoryBtn: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  footerHistoryText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },

  btn: { flexGrow: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  btnAccept: { backgroundColor: '#16A34A' },
  btnAcceptText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  btnReject: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  btnRejectText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  btnCounter: { backgroundColor: '#0F172A' },
  btnCounterText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  btnPass: { backgroundColor: colors.bgChip },
  btnPassText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

  // History cards
  histCard: { backgroundColor: colors.bgWhite, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  histTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  histRound: { fontSize: 13, fontWeight: '800', color: colors.textPrimary, flexShrink: 1 },
  histBadge: { backgroundColor: colors.bgChip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  histBadgeText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize' },
  histWho: { fontSize: 12, color: colors.textMuted },
  histPrice: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  histNote: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  histTime: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
});
