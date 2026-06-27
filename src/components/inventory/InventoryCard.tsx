import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ContextMenu, type ContextMenuItem } from '../shared/ContextMenu';
import { ProductImage } from '../shared/ProductImage';
import { colors, radius } from '../../theme/tokens';
import type { InventoryListItem } from '../../services/supabase/inventory';

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function priceLine(currency: string, price: number | null, unit: string): string | null {
  if (price === null || price === undefined) return null;
  return `${currency} ${price.toLocaleString()}/${unit}`;
}

type InventoryCardProps = {
  item: InventoryListItem;
  onPress: () => void;
  onShare?: () => void;
  /** Whether this card's ⋮ menu is the one currently open (one-at-a-time, owned by the list). */
  menuOpen?: boolean;
  onMenuToggle?: () => void;
  onMenuClose?: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

/**
 * My Inventory grid card: a [thumbnail | info] top row, a divider, then a footer
 * with the time-ago (+ pending badge) on the left and the share / ⋮ quick-action
 * buttons on the right. Lifts on hover (web). The ⋮ button opens a
 * View / Edit / Share / Delete context menu. Rendered in a responsive grid.
 */
export function InventoryCard({
  item,
  onPress,
  onShare,
  menuOpen = false,
  onMenuToggle,
  onMenuClose,
  onView,
  onEdit,
  onDelete,
}: InventoryCardProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  const anchorRef = useRef<View | null>(null);
  const price = priceLine(item.currency, item.price, item.unit);

  const hasMenu = Boolean(onMenuToggle);
  const run = (fn?: () => void): void => {
    onMenuClose?.();
    fn?.();
  };
  const menuItems: ContextMenuItem[] = [
    ...(onView ? [{ icon: '👁️', label: 'View', onPress: () => run(onView) }] : []),
    ...(onEdit ? [{ icon: '✏️', label: 'Edit', onPress: () => run(onEdit) }] : []),
    ...(onShare ? [{ icon: '⤴️', label: 'Share', onPress: () => run(onShare) }] : []),
    ...(onDelete ? [{ icon: '🗑️', label: 'Delete', danger: true, onPress: () => run(onDelete) }] : []),
  ];

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.card, hovered ? styles.cardHover : null, menuOpen ? styles.cardElevated : null]}
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
          <Text style={styles.name} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.code} numberOfLines={1}>
            {item.product_code ?? '—'} | {item.category ?? 'General'}
          </Text>
          {price ? (
            <Text style={styles.price} numberOfLines={1}>
              {price}
            </Text>
          ) : (
            <Text style={styles.priceEmpty}>—</Text>
          )}
          <Text style={styles.qty} numberOfLines={1}>
            <Text style={styles.qtyAvail}>{item.quantity_available}</Text>
            <Text style={styles.qtyMuted}>
              /{item.quantity} {item.unit}
            </Text>
          </Text>
        </View>
      </View>

      {/* Divider + footer: time-ago (+ pending) left, quick actions right */}
      <View style={styles.divider} />
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.timeWrap}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={styles.time}>{daysAgo(item.created_at)}</Text>
          </View>
          {item.pending_count > 0 ? (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>⚠ {item.pending_count} pending</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {onShare ? <ActionButton icon="share-social-outline" onPress={onShare} /> : null}
          {hasMenu ? (
            <View ref={anchorRef} style={styles.menuAnchor}>
              <ActionButton icon="ellipsis-vertical" onPress={onMenuToggle} testID={`inv-menu-${item.inventory_id}`} />
              <ContextMenu visible={menuOpen} items={menuItems} onClose={() => onMenuClose?.()} anchorRef={anchorRef} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Quick-action button — 30×30, 6px radius, #E2E8F0 border, white fill,
 * #475569 glyph. Lights up to #F8FAFC on hover (web).
 */
function ActionButton({
  icon,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  testID?: string;
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      style={[styles.actionBtn, hovered ? styles.actionBtnHover : null]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      hitSlop={4}
      testID={testID}
    >
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
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
    borderColor: colors.border, // #E2E8F0
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  // hover — box-shadow 0 4px 12px rgba(0,0,0,0.10) + border-color #CBD5E1
  cardHover: {
    borderColor: colors.borderDark, // #CBD5E1
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  // Lift above sibling cards while its menu is open so the dropdown isn't clipped.
  cardElevated: { zIndex: 50 },

  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },

  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  code: { fontSize: 11, color: colors.textMuted, marginBottom: 6 },
  price: { fontSize: 14, fontWeight: '700', color: colors.green, marginBottom: 3 },
  priceEmpty: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginBottom: 3 },
  qty: { fontSize: 12 },
  qtyAvail: { color: colors.textPrimary, fontWeight: '700' },
  qtyMuted: { color: colors.textMuted },

  divider: { height: 1, backgroundColor: colors.border, marginTop: 12, marginBottom: 10 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  time: { fontSize: 11, color: colors.textMuted },
  // pending pill — #FFF7ED bg / #F97316 text
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.orangeLight,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  pendingText: { fontSize: 11, fontWeight: '600', color: colors.orange },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, zIndex: 20 },
  // Relative wrapper so the dropdown anchors to the ⋮ button (top:100%, right:0).
  menuAnchor: { position: 'relative', zIndex: 1000 },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm, // 6
    borderWidth: 1,
    borderColor: colors.border, // #E2E8F0
    backgroundColor: colors.bgWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // hover — background #F8FAFC
  actionBtnHover: { backgroundColor: colors.bgPage },
});
