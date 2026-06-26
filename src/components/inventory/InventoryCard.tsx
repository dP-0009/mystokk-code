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
 * Inventory grid card (mirror `.ic`): thumbnail + info block, with share/menu
 * quick-actions pinned top-right. Lifts on hover (web). The ⋮ button opens a
 * View / Edit / Share / Delete context menu (mirror `.ddm`).
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
      {/* `.ith` thumbnail */}
      <ProductImage
        uri={item.thumbUrl}
        width={72}
        height={72}
        borderRadius={radius.md}
        fallback={<Ionicons name="cube-outline" size={26} color={colors.textMuted} />}
      />

      {/* `.ii` info block */}
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
          {item.quantity_available}/{item.quantity} {item.unit}
        </Text>
        {item.pending_count > 0 ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>⚠ {item.pending_count} pending</Text>
          </View>
        ) : null}
        <Text style={styles.time}>🕐 {daysAgo(item.created_at)}</Text>
      </View>

      {/* `.ia` quick actions */}
      <View style={styles.actions}>
        {onShare ? (
          <Pressable style={styles.actionBtn} onPress={onShare} hitSlop={4}>
            <Ionicons name="share-social-outline" size={14} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        {hasMenu ? (
          <View ref={anchorRef} style={styles.menuAnchor}>
            <Pressable style={styles.actionBtn} onPress={onMenuToggle} hitSlop={4} testID={`inv-menu-${item.inventory_id}`}>
              <Ionicons name="ellipsis-vertical" size={14} color={colors.textSecondary} />
            </Pressable>
            <ContextMenu visible={menuOpen} items={menuItems} onClose={() => onMenuClose?.()} anchorRef={anchorRef} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // `.ic` — horizontal row: [thumb 72] [info flex-1] [share] [3-dot]
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border, // #E2E8F0
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  // `.ic:hover` — box-shadow 0 4px 12px rgba(0,0,0,0.10)
  cardHover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  // Lift above sibling cards while its menu is open so the dropdown isn't clipped.
  cardElevated: { zIndex: 50 },
  // `.ith`
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.bgChip,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImg: { width: '100%', height: '100%' },
  // `.ii`
  info: { flex: 1, minWidth: 0 },
  // `.iname`
  name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  // `.icode`
  code: { fontSize: 11, color: colors.textMuted, marginBottom: 6 },
  // `.iprice`
  price: { fontSize: 13, fontWeight: '700', color: colors.accent, marginBottom: 3 },
  priceEmpty: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 3 },
  // `.iqty`
  qty: { fontSize: 12, color: colors.textSecondary },
  // `.pb-badge`
  pendingBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.orangeLight,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  pendingText: { fontSize: 11, fontWeight: '600', color: colors.orange },
  // `.itime`
  time: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  // `.ia` — inline at the end of the row.
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, zIndex: 20 },
  // Relative wrapper so the dropdown anchors to the ⋮ button (top:100%, right:0).
  menuAnchor: { position: 'relative', zIndex: 1000 },
  // `.ib`
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
