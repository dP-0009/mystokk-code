import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IncomingReservation, OutgoingReservation } from '../../services/supabase/reservations';
import { colors, radius } from '../../theme/tokens';
import { webOnly } from '../layout/web';

type AnyReservation = IncomingReservation | OutgoingReservation;

/** Status → badge colors + label (design spec). Unknown statuses fall back to slate. */
const BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  confirmed: { bg: colors.greenLight, fg: colors.green, label: 'Confirmed' }, // #DCFCE7 / #16A34A
  rejected: { bg: colors.redLight, fg: colors.red, label: 'Rejected' }, // #FEF2F2 / #DC2626
  pending: { bg: colors.orangeLight, fg: colors.orange, label: 'Pending' }, // #FFF7ED / #F97316
  negotiating: { bg: colors.accentLight, fg: colors.accent, label: 'Negotiating' },
  passed: { bg: colors.bgChip, fg: colors.slate500, label: 'Passed' },
  cancelled: { bg: colors.bgChip, fg: colors.slate500, label: 'Cancelled' }, // #F1F5F9 / #64748B
};

function badgeFor(status: string): { bg: string; fg: string; label: string } {
  return BADGE[status] ?? { bg: colors.bgChip, fg: colors.slate500, label: status };
}

/** Compact relative age for the card timestamp, e.g. "just now", "5m ago", "2d ago". */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return `${Math.round(day / 7)}w ago`;
}

/** Effective price/unit line, e.g. "450,000/barrels". */
function priceUnit(r: AnyReservation): string {
  const p =
    r.status === 'negotiating' && r.latest_counter_price != null
      ? r.latest_counter_price
      : r.offered_price ?? r.list_price;
  if (p === null || p === undefined) return '—';
  return `${p.toLocaleString()}/${r.unit}`;
}

interface ReservationCardProps {
  item: AnyReservation;
  /** 'received' = a request you must respond to; 'sent' = a request you made. */
  side: 'received' | 'sent';
  onPress: () => void;
}

export function ReservationCard({ item, side, onPress }: ReservationCardProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const badge = badgeFor(item.status);
  const vendor = item.counterparty_company ?? 'a vendor';
  const qtyUnit = `${item.quantity.toLocaleString()} ${item.unit}`;
  const sentence = side === 'sent' ? `You requested ${qtyUnit} from ${vendor}` : `${vendor} requested ${qtyUnit}`;
  // Cancelled reservations stay in the list but read as inactive (faded).
  const cancelled = item.status === 'cancelled';

  return (
    <Pressable
      style={[styles.card, hovered ? styles.cardHover : null, cancelled ? styles.cardCancelled : null]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      testID={`reservation-card-${item.reservation_id}`}
    >
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {item.item_title}
        </Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
        </View>
      </View>

      <Text style={styles.detail} numberOfLines={1}>
        {sentence}
      </Text>
      <Text style={styles.detail} numberOfLines={1}>
        {priceUnit(item)}
      </Text>
      {item.message ? (
        <Text style={styles.message} numberOfLines={2}>
          “{item.message}”
        </Text>
      ) : null}
      <Text style={styles.timestamp}>{timeAgo(item.created_at)}</Text>
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
    ...webOnly({ cursor: 'pointer' }),
  },
  // hover — border #CBD5E1 + box-shadow 0 2px 8px rgba(0,0,0,0.08)
  cardHover: {
    borderColor: colors.borderDark,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  // Cancelled reservations stay visible but faded.
  cardCancelled: { opacity: 0.75 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },

  // Status badge — radius 20, padding 2/9, 11px/600
  badge: { borderRadius: 20, paddingVertical: 2, paddingHorizontal: 9, flexShrink: 0 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  detail: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  message: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 6, lineHeight: 17 },
  timestamp: { fontSize: 11, color: colors.textMuted, marginTop: 8 }, // #94A3B8
});
