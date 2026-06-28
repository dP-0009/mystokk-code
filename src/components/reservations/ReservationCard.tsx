import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { IncomingReservation, OutgoingReservation } from '../../services/supabase/reservations';
import { ProductImage } from '../shared/ProductImage';
import { colors, radius } from '../../theme/tokens';
import { webOnly } from '../layout/web';

type AnyReservation = IncomingReservation | OutgoingReservation;

/** Status → badge colors + label (design spec). Unknown statuses fall back to slate. */
const BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  confirmed: { bg: colors.greenLight, fg: colors.green, label: 'Confirmed' },
  rejected: { bg: colors.redLight, fg: colors.red, label: 'Rejected' },
  pending: { bg: colors.orangeLight, fg: colors.orange, label: 'Pending' },
  negotiating: { bg: colors.accentLight, fg: colors.accent, label: 'Negotiating' },
  passed: { bg: colors.bgChip, fg: colors.slate500, label: 'Passed' },
  cancelled: { bg: colors.bgChip, fg: colors.slate500, label: 'Cancelled' },
};

function badgeFor(status: string): { bg: string; fg: string; label: string } {
  return BADGE[status] ?? { bg: colors.bgChip, fg: colors.slate500, label: status };
}

/** Absolute timestamp, e.g. "07/05/2026, 15:50:48" (mirrors the design). */
function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

/** Effective offered price/unit, e.g. "150/pcs", or null when none. */
function offeredLine(r: AnyReservation): string | null {
  const p =
    r.status === 'negotiating' && r.latest_counter_price != null
      ? r.latest_counter_price
      : r.offered_price;
  if (p === null || p === undefined) return null;
  return `${p.toLocaleString()}/${r.unit}`;
}

interface ReservationCardProps {
  item: AnyReservation;
  /** 'received' = a request you must respond to; 'sent' = a request you made. */
  side: 'received' | 'sent';
  /** Open the negotiation popup (card click / Negotiate). */
  onOpen: () => void;
  /** Confirm (accept) — received pending/negotiating only. */
  onConfirm?: () => void;
  /** Reject — received pending/negotiating only. */
  onReject?: () => void;
  busy?: boolean;
}

export function ReservationCard({ item, side, onOpen, onConfirm, onReject, busy }: ReservationCardProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const badge = badgeFor(item.status);
  const vendor = item.counterparty_company ?? 'a vendor';
  const qtyUnit = `${item.quantity.toLocaleString()} ${item.unit}`;
  const offered = offeredLine(item);
  const cancelled = item.status === 'cancelled';

  // Turn-based actions: only the party whose turn it is to respond sees the
  // action buttons; the one who moved last sees a History button + a waiting
  // hint. A fresh request awaits the seller; mid-negotiation it awaits whoever
  // did NOT send the latest counter (latest_round_by_me).
  const open = item.status === 'pending' || item.status === 'negotiating';
  const isRequester = side === 'sent';
  const lastMoveByMe = item.status === 'pending' ? isRequester : item.latest_round_by_me ?? false;
  const myTurn = open && !lastMoveByMe;
  const waiting = open && lastMoveByMe;
  const email = item.counterparty_email;

  return (
    <View style={[styles.card, hovered ? styles.cardHover : null, cancelled ? styles.cardCancelled : null]}>
      {/* Body — thumbnail + info (clicking opens the negotiation popup) */}
      <Pressable
        style={[styles.body, webOnly({ cursor: 'pointer' })]}
        onPress={onOpen}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        testID={`reservation-card-${item.reservation_id}`}
      >
        <ProductImage
          uri={item.thumbUrl ?? null}
          width={88}
          height={88}
          borderRadius={radius.md}
          fallback={<Ionicons name="cube-outline" size={28} color={colors.textMuted} />}
        />

        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.item_title}
            </Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={13} color={colors.textMuted} />
            <Text style={styles.meta} numberOfLines={1}>
              {side === 'sent' ? 'You requested ' : `${vendor} requested `}
              <Text style={styles.metaStrong}>{qtyUnit}</Text>
              {side === 'sent' ? ` from ${vendor}` : ''}
            </Text>
          </View>

          {offered ? <Text style={styles.offered}>Offered: {offered}</Text> : null}

          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={styles.timestamp}>{stamp(item.created_at)}</Text>
          </View>
        </View>
      </Pressable>

      {/* Action row — contact icons left, turn-based actions right */}
      <View style={styles.actionRow}>
        <View style={styles.contactIcons}>
          {email ? (
            <ContactIcon name="mail-outline" onPress={() => Linking.openURL(`mailto:${email}`)} label="Email" />
          ) : null}
          {waiting ? (
            <Text style={styles.waitingText} numberOfLines={1}>
              Waiting for {vendor} to respond…
            </Text>
          ) : null}
        </View>

        {/* Whoever moved last sees only History; whoever's turn it is gets actions. */}
        {waiting ? (
          <Pressable
            style={[styles.historyBtn, webOnly({ cursor: 'pointer' })]}
            onPress={onOpen}
            testID={`reservation-history-${item.reservation_id}`}
          >
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.historyText}>History</Text>
          </Pressable>
        ) : myTurn ? (
          <View style={styles.actions}>
            <Pressable
              style={[styles.negotiateBtn, webOnly({ cursor: 'pointer' })]}
              onPress={onOpen}
              testID={`reservation-negotiate-${item.reservation_id}`}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.purple} />
              <Text style={styles.negotiateText}>Negotiate</Text>
            </Pressable>
            {side === 'received' ? (
              <Pressable
                style={[styles.rejectBtn, busy ? styles.btnDisabled : null, webOnly({ cursor: 'pointer' })]}
                onPress={onReject}
                disabled={busy}
                testID={`reservation-reject-${item.reservation_id}`}
              >
                <Ionicons name="close" size={16} color={colors.red} />
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.confirmBtn, busy ? styles.btnDisabled : null, webOnly({ cursor: 'pointer' })]}
              onPress={onConfirm}
              disabled={busy}
              testID={`reservation-confirm-${item.reservation_id}`}
            >
              <Ionicons name="checkmark" size={15} color={colors.bgWhite} />
              <Text style={styles.confirmText}>{side === 'received' ? 'Confirm' : 'Accept'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Small circular contact/utility icon button. */
function ContactIcon({
  name,
  onPress,
  label,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  label: string;
}): React.JSX.Element {
  return (
    <Pressable style={[styles.contactBtn, webOnly({ cursor: 'pointer' })]} onPress={onPress} accessibilityLabel={label}>
      <Ionicons name={name} size={15} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg, // 16
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  cardHover: {
    borderColor: colors.borderDark,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardCancelled: { opacity: 0.75 },

  body: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  info: { flex: 1, minWidth: 0 },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  badge: { borderRadius: 20, paddingVertical: 2, paddingHorizontal: 9, flexShrink: 0 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  meta: { flexShrink: 1, fontSize: 12, color: colors.textSecondary },
  metaStrong: { fontWeight: '700', color: colors.textPrimary },
  offered: { fontSize: 12, fontWeight: '700', color: colors.green, marginTop: 6 },
  timestamp: { fontSize: 11, color: colors.textMuted },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contactIcons: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  waitingText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', flexShrink: 1 },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgWhite,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  historyText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  contactBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  negotiateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.purpleLight,
    backgroundColor: colors.bgWhite,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  negotiateText: { fontSize: 13, fontWeight: '600', color: colors.purple },
  rejectBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: colors.bgWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.green,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  confirmText: { fontSize: 13, fontWeight: '600', color: colors.bgWhite },
  btnDisabled: { opacity: 0.5 },
});
