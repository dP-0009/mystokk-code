import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
 * Reservation negotiation popup (spec). Header (item + status), request info,
 * a scrollable message thread, and pending actions (Accept / Reject / Counter).
 * Counter Offer reveals price + note inputs inline; a History button opens a
 * second popup with the full round-by-round timeline.
 */
export function NegotiationModal({ visible, side, data, onClose }: NegotiationModalProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const incoming = side === 'incoming';

  const [status, setStatus] = useState(data.status);
  const [mode, setMode] = useState<'view' | 'counter'>('view');
  const [negPrice, setNegPrice] = useState('');
  const [negNote, setNegNote] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const roundsQuery = useQuery({
    queryKey: ['negotiation', data.reservation_id],
    queryFn: () => getNegotiationRounds(data.reservation_id),
    staleTime: 15_000,
    enabled: visible,
  });
  const rounds = roundsQuery.data ?? [];
  const myRoundsUsed = rounds.filter((r) => r.is_me).length;
  const lastRound = rounds[rounds.length - 1];
  const lastByMe = lastRound?.is_me ?? false;

  const actionable = status === 'pending' || status === 'negotiating';
  // FIX C — after you send a counter offer the ball is in their court: lock all
  // actions and show a waiting banner until the other party responds. `is_me` is
  // the server's lastRound.sender_id === currentUserId comparison.
  const waitingForReply = status === 'negotiating' && lastByMe;
  const canCounter = actionable && myRoundsUsed < MAX_ROUNDS && (status === 'negotiating' || incoming);
  const canAccept = actionable && (status === 'pending' ? incoming : !lastByMe);
  const canReject = incoming && actionable;
  const canCancel = !incoming && actionable;
  const canPass = incoming && actionable && data.is_middleman;
  const otherParty = data.counterparty_company ?? 'the other party';

  // Reset transient UI each time the modal (re)opens for a reservation.
  React.useEffect(() => {
    if (visible) {
      setStatus(data.status);
      setMode('view');
      setNegPrice('');
      setNegNote('');
      setHistoryOpen(false);
    }
  }, [visible, data.status, data.reservation_id]);

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

  const counterQty = data.latest_counter_qty ?? data.quantity;
  const counter = useMutation({
    mutationFn: () => submitNegotiationRound(data.reservation_id, Number(negPrice), Number(counterQty), negNote.trim() || null),
    onSuccess: () => {
      setMode('view');
      setNegPrice('');
      setNegNote('');
      setStatus('negotiating');
      void roundsQuery.refetch();
      invalidate();
      toast.success('Counter offer sent!');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not send counter.'),
  });

  // Conversation thread: original request note + every round that carried a message.
  type Msg = { key: string; mine: boolean; sender: string; text: string; time: string };
  const messages: Msg[] = [];
  if (data.message) {
    messages.push({
      key: 'request',
      mine: !incoming,
      sender: incoming ? data.counterparty_company ?? 'Buyer' : 'You',
      text: data.message,
      time: when(data.created_at),
    });
  }
  rounds.forEach((r, i) => {
    if (r.message) {
      messages.push({
        key: `round-${r.round_number}-${i}`,
        mine: r.is_me,
        sender: r.is_me ? 'You' : r.proposer_company ?? data.counterparty_company ?? 'Them',
        text: r.message,
        time: when(r.created_at),
      });
    }
  });

  const offeredDisplay = money(data.currency, data.offered_price ?? data.list_price);

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
                <ActivityIndicator color={colors.accent} style={styles.loading} />
              ) : messages.length === 0 ? (
                <Text style={styles.empty}>No messages yet.</Text>
              ) : (
                <View style={styles.thread}>
                  {messages.map((m) => (
                    <View key={m.key} style={[styles.bubbleRow, m.mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                      <View style={[styles.bubble, m.mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                        <Text style={styles.bubbleSender}>{m.sender}</Text>
                        <Text style={styles.bubbleText}>{m.text}</Text>
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
                    {counter.isPending ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.btnSendText}>Send Counter Offer</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* 3. Footer — cancelled banner (FIX D) / waiting banner (FIX C) / actions */}
          {status === 'cancelled' ? (
            <View style={styles.bannerWrap}>
              <View style={styles.banner}>
                <Text style={styles.bannerText}>This reservation was cancelled.</Text>
              </View>
            </View>
          ) : waitingForReply && mode === 'view' ? (
            <View style={styles.bannerWrap}>
              <View style={styles.banner}>
                <Text style={styles.bannerText}>Waiting for {otherParty} to respond...</Text>
              </View>
            </View>
          ) : actionable && mode === 'view' ? (
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
            currency={data.currency}
            status={status}
            onClose={() => setHistoryOpen(false)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Full negotiation history — round-by-round cards, oldest first. */
function HistoryModal({
  visible,
  rounds,
  currency,
  status,
  onClose,
}: {
  visible: boolean;
  rounds: NegotiationRound[];
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
            {rounds.length === 0 ? (
              <Text style={styles.empty}>No counter-offers yet — this is the original request.</Text>
            ) : (
              rounds.map((r, i) => {
                const isLast = i === rounds.length - 1;
                const outcome = isLast && status !== 'negotiating' && status !== 'pending' ? status : 'countered';
                return (
                  <View key={`${r.round_number}-${i}`} style={styles.histCard}>
                    <View style={styles.histTop}>
                      <Text style={styles.histRound}>Round {r.round_number}</Text>
                      <View style={styles.histBadge}>
                        <Text style={styles.histBadgeText}>{outcome}</Text>
                      </View>
                    </View>
                    <Text style={styles.histWho}>{r.is_me ? 'You offered' : `${r.proposer_company ?? 'They'} offered`}</Text>
                    <Text style={styles.histPrice}>
                      {money(currency, r.counter_price)} · Qty {r.counter_quantity?.toLocaleString() ?? '—'}
                    </Text>
                    {r.message ? <Text style={styles.histNote}>“{r.message}”</Text> : null}
                    <Text style={styles.histTime}>{when(r.created_at)}</Text>
                  </View>
                );
              })
            )}
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
  empty: { fontSize: 13, color: colors.textMuted },

  // Conversation thread
  thread: { gap: 10 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: colors.accentLight }, // #EFF6FF
  bubbleTheirs: { backgroundColor: colors.bgChip }, // #F1F5F9
  bubbleSender: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 2 },
  bubbleText: { fontSize: 13, color: colors.textPrimary },
  bubbleTime: { fontSize: 10, color: colors.textMuted, marginTop: 4 },

  // Counter form
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

  // Grey status banner (waiting for reply / cancelled) — replaces the actions.
  bannerWrap: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border },
  banner: { backgroundColor: '#F1F5F9', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16 },
  bannerText: { fontSize: 13, color: '#64748B', textAlign: 'center', fontWeight: '600' },
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
  histRound: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  histBadge: { backgroundColor: colors.bgChip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  histBadgeText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize' },
  histWho: { fontSize: 12, color: colors.textMuted },
  histPrice: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  histNote: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  histTime: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
});
