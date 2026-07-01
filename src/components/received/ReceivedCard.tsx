import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ReceivedListItem } from '../../services/supabase/received';
import { ProductImage } from '../shared/ProductImage';
import { colors, radius, shadows } from '../../theme/tokens';

/** Currency code → symbol. Codes without a common glyph fall back to a prefix. */
const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
};

/** "$1,000,000/pcs" / "₹792,200/kg" / "N/A" when no display price. */
function formatPrice(currency: string | null, price: number | null, unit: string): string {
  if (price === null || price === undefined) return 'N/A';
  const symbol = currency ? CURRENCY_SYMBOL[currency] ?? `${currency} ` : '';
  return `${symbol}${price.toLocaleString()}/${unit}`;
}

/** Compact age, e.g. "15d", "6h", "3m", "now". */
function compactTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const day = Math.floor(diff / 86_400_000);
  if (day >= 1) return `${day}d ago`;
  const hr = Math.floor(diff / 3_600_000);
  if (hr >= 1) return `${hr}h ago`;
  const min = Math.floor(diff / 60_000);
  if (min >= 1) return `${min}m ago`;
  return 'now';
}

interface ReceivedCardProps {
  item: ReceivedListItem;
  onPress: () => void;
}

/**
 * Received-inventory grid card: a [thumbnail | info] top row, a divider, and a
 * footer row with the sharing vendor on the left and the time-ago on the right.
 * Rendered in a responsive multi-column grid by ReceivedListScreen.
 */
export function ReceivedCard({ item, onPress }: ReceivedCardProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      style={[styles.card, hovered ? styles.cardHover : null]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      testID={`received-card-${item.share_id}`}
    >
      {/* Top: thumbnail + info */}
      <View style={styles.top}>
        <ProductImage
          uri={item.thumbUrl}
          width={84}
          height={84}
          borderRadius={radius.md}
          fallback={<Ionicons name="cube-outline" size={28} color={colors.textMuted} />}
        />

        <View style={styles.info}>
          {/* Title, then stock location on its own line below it. */}
          <Text style={styles.name} numberOfLines={1}>
            {item.title}
          </Text>
          {item.stock_location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.location} numberOfLines={1}>
                {item.stock_location}
              </Text>
            </View>
          ) : null}
          <Text style={styles.qty} numberOfLines={1}>
            <Text style={styles.qtyAvail}>{item.quantity_available.toLocaleString()}</Text>
            <Text style={styles.qtyMuted}>
              /{item.quantity.toLocaleString()} {item.unit}
            </Text>
          </Text>
          {/* Price last. */}
          <Text style={styles.price} numberOfLines={1}>
            {formatPrice(item.display_currency, item.display_price, item.unit)}
          </Text>
        </View>
      </View>

      {/* Divider + footer: From vendor (left), time-ago (right) */}
      <View style={styles.divider} />
      <View style={styles.footer}>
        <Text style={styles.from} numberOfLines={1}>
          From: <Text style={styles.fromName}>{item.shared_by_company_name ?? 'a vendor'}</Text>
        </Text>
        <View style={styles.timeWrap}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.time}>{compactTime(item.created_at)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    // Grid item — ~3 across on desktop, wraps to 2 / 1 as width shrinks.
    flexGrow: 1,
    flexBasis: '31%',
    minWidth: 300,
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg, // 16
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  // hover — box-shadow 0 4px 12px rgba(0,0,0,0.10) + border #CBD5E1
  cardHover: { borderColor: colors.borderDark, ...shadows.md },

  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },

  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  // Stock location, on its own line under the title (map-pin + value), 12px #475569.
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  location: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  price: { fontSize: 14, fontWeight: '700', color: colors.green, marginTop: 4 },
  qty: { fontSize: 12, marginTop: 8 },
  qtyAvail: { color: colors.textPrimary, fontWeight: '700' },
  qtyMuted: { color: colors.textMuted },

  divider: { height: 1, backgroundColor: colors.border, marginTop: 12, marginBottom: 10 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  from: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  fromName: { color: colors.textSecondary, fontWeight: '700' },
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  time: { fontSize: 11, color: colors.textMuted },
});
