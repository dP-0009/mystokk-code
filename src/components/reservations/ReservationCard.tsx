import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IncomingReservation, OutgoingReservation } from '../../services/supabase/reservations';
import { colors, radius, shadows } from '../../theme/tokens';

type AnyReservation = IncomingReservation | OutgoingReservation;

/** Status → badge colors + label (design spec). Unknown statuses fall back to slate. */
const BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  confirmed: { bg: colors.greenLight, fg: colors.green, label: 'Confirmed' },
  rejected: { bg: colors.redLight, fg: colors.red, label: 'Rejected' },
  pending: { bg: colors.orangeLight, fg: colors.orange, label: 'Pending' },
  negotiating: { bg: colors.accentLight, fg: colors.accent, label: 'Negotiating' },
  passed: { bg: colors.bgChip, fg: colors.textSecondary, label: 'Passed' },
  cancelled: { bg: colors.bgChip, fg: colors.textMuted, label: 'Cancelled' },
};

function badgeFor(status: string): { bg: string; fg: string; label: string } {
  return BADGE[status] ?? { bg: colors.bgChip, fg: colors.textSecondary, label: status };
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

  return (
    <Pressable
      style={[styles.card, hovered ? styles.cardHover : null]}
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
  cardHover: { borderColor: colors.borderDark, ...shadows.sm },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },

  // Status badge — radius 20, padding 2/9, 11px/600
  badge: { borderRadius: 20, paddingVertical: 2, paddingHorizontal: 9, flexShrink: 0 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  detail: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  message: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 6, lineHeight: 17 },
});
