import React from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MystokkLoader } from '../components/shared/MystokkLoader';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../navigation';
import { deleteInventory, listInventory, type InventoryListItem } from '../services/supabase/inventory';
import { INVENTORY_FILTERS, type InventoryStatus } from '../constants/inventory';

/** Status filter options minus "Archived" (not offered in the mobile UI). */
const STATUS_OPTIONS = INVENTORY_FILTERS.filter((f) => f.status !== 'archived');
import { ShareModal } from '../components/share/ShareModal';
import { usePullRefresh } from '../hooks/usePullRefresh';
import { confirmAction } from '../utils/confirm';
import { toast } from '../stores/toast';
import {
  Button,
  Card,
  GlassPanel,
  Icon,
  NavButton,
  ScreenBackground,
  Sheet,
  SheetAction,
  TabHeader,
  Thumb,
  colors,
  glass,
  radii,
  relativeTimeShort,
  spacing,
  useTabBarSpace,
} from '../components/mobile';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Inventory'>,
  NativeStackScreenProps<RootStackParamList>
>;

/** Compact price for the card (prototype's green price line). */
function priceLabel(item: InventoryListItem): string {
  if (item.price === null) return 'Price on request';
  return `${item.currency} ${item.price.toLocaleString()}/${item.unit}`;
}

/**
 * Inventory tab (prototype SCREENS.inventory). Bound to the existing
 * listInventory query and deleteInventory mutation; the share button reuses the
 * existing ShareModal (its own share-creation logic). Add / Edit / View route to
 * the existing screens.
 */
export function InventoryListScreen({ navigation }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const bottomPad = useTabBarSpace();

  const [filter, setFilter] = React.useState<InventoryStatus | null>(null);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [actionsFor, setActionsFor] = React.useState<InventoryListItem | null>(null);
  const [shareItem, setShareItem] = React.useState<InventoryListItem | null>(null);

  React.useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventory', filter, search],
    queryFn: () => listInventory(filter, search),
    staleTime: 30_000,
  });

  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const deleteMutation = useMutation({
    mutationFn: deleteInventory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.delete('Item deleted successfully!');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not delete item.'),
  });

  const confirmDelete = (item: InventoryListItem): void => {
    setActionsFor(null);
    confirmAction({
      title: 'Delete item?',
      message: `“${item.title}” will be permanently removed.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deleteMutation.mutate(item.inventory_id),
    });
  };

  useFocusEffect(
    React.useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const items = data ?? [];
  const activeFilterLabel = INVENTORY_FILTERS.find((f) => f.status === filter)?.label ?? 'All';

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.addRow}>
        <Button
          label="Add Item"
          variant="dark"
          icon={<Icon name="plus" size={18} color="#FFFFFF" />}
          onPress={() => navigation.navigate('InventoryCreate')}
          style={styles.addBtn}
        />
      </View>
      <View style={styles.searchRow}>
        <GlassPanel effect="clear" radius={radii.row} fill={glass.fillInput} style={styles.searchPill}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search items…"
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            autoCorrect={false}
          />
        </GlassPanel>
        {/* Icon-only funnel filter button → status sheet. */}
        <NavButton icon="filter" size={45} onPress={() => setFilterOpen(true)} />
      </View>
      {filter !== null ? (
        <Text style={styles.activeFilter}>Filter: {activeFilterLabel}</Text>
      ) : null}
    </View>
  );

  return (
    <ScreenBackground>
      <TabHeader title="My Inventory" subtitle={`${items.length} item${items.length === 1 ? '' : 's'}`} />

      {isLoading ? (
        <View style={styles.center}>
          <MystokkLoader showText />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Failed to load.'}</Text>
          <Button label="Retry" variant="ghost" size="sm" onPress={() => void refetch()} />
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(it) => it.inventory_id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{search ? 'No matches' : 'No items yet'}</Text>
              <Text style={styles.emptyText}>
                {search ? 'No items match your search.' : 'Add your first inventory item to get started.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              onPress={() => navigation.navigate('InventoryDetail', { inventoryId: item.inventory_id })}
              onShare={() => setShareItem(item)}
              onMenu={() => setActionsFor(item)}
            />
          )}
        />
      )}

      {/* Status filter sheet (prototype SHEETS.statusFilter) — actually filters. */}
      <Sheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter by status"
        description="Show items with status"
      >
        {STATUS_OPTIONS.map((f, i) => {
          const selected = f.status === filter;
          return (
            <SheetAction
              key={f.label}
              icon={selected ? 'check' : 'box'}
              label={f.label}
              last={i === STATUS_OPTIONS.length - 1}
              onPress={() => {
                setFilter(f.status);
                setFilterOpen(false);
              }}
              trailing={selected ? <Icon name="check" size={18} color={colors.blue} /> : undefined}
            />
          );
        })}
      </Sheet>

      {/* Item actions sheet (prototype SHEETS.invActions): View / Edit / Share / Delete. */}
      <Sheet
        open={actionsFor !== null}
        onClose={() => setActionsFor(null)}
        title="Item actions"
        description={actionsFor?.title}
      >
        <SheetAction
          icon="eye"
          label="View"
          onPress={() => {
            const it = actionsFor;
            setActionsFor(null);
            if (it) navigation.navigate('InventoryDetail', { inventoryId: it.inventory_id });
          }}
        />
        <SheetAction
          icon="edit"
          label="Edit"
          onPress={() => {
            const it = actionsFor;
            setActionsFor(null);
            if (it) navigation.navigate('InventoryEdit', { inventoryId: it.inventory_id });
          }}
        />
        <SheetAction
          icon="share"
          label="Share"
          onPress={() => {
            const it = actionsFor;
            setActionsFor(null);
            if (it) setShareItem(it);
          }}
        />
        <SheetAction
          icon="trash"
          label="Delete"
          danger
          last
          onPress={() => actionsFor && confirmDelete(actionsFor)}
        />
      </Sheet>

      {/* Share — existing ShareModal (its own share-creation logic). */}
      <ShareModal
        visible={shareItem !== null}
        inventoryId={shareItem?.inventory_id ?? ''}
        card={
          shareItem
            ? {
                title: shareItem.title,
                quantityAvailable: shareItem.quantity_available,
                quantityTotal: shareItem.quantity,
                unit: shareItem.unit,
              }
            : undefined
        }
        onClose={() => setShareItem(null)}
        onShared={() => {
          void queryClient.invalidateQueries({ queryKey: ['inventory'] });
          void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }}
      />
    </ScreenBackground>
  );
}

/** One inventory card (prototype SCREENS.inventory card). */
function ItemCard({
  item,
  onPress,
  onShare,
  onMenu,
}: {
  item: InventoryListItem;
  onPress: () => void;
  onShare: () => void;
  onMenu: () => void;
}): React.JSX.Element {
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.cardTop}>
        {item.thumbUrl ? (
          <Image source={{ uri: item.thumbUrl }} style={styles.photo} />
        ) : (
          <Thumb name={item.title} size={92} radius={16} />
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.qty}>
            <Text style={styles.qtyAvail}>{item.quantity_available.toLocaleString()}</Text>
            <Text style={styles.qtyTotal}>
              /{item.quantity.toLocaleString()} {item.unit}
            </Text>
          </Text>
          <Text style={styles.price}>{priceLabel(item)}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.updated}>
          <Icon name="clock" size={14} color={colors.placeholder} />
          <Text style={styles.updatedText}>updated {relativeTimeShort(item.created_at)}</Text>
        </View>
        <View style={styles.cardActions}>
          <NavButton icon="share" size={38} onPress={onShare} />
          <NavButton icon="dots" size={38} onPress={onMenu} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerBlock: { paddingTop: 14 },
  addRow: { alignItems: 'flex-end', marginBottom: 12 },
  addBtn: { alignSelf: 'flex-end' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, height: 45, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  activeFilter: { marginTop: 10, fontSize: 12.5, fontWeight: '700', color: colors.blueDark },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  errorText: { color: colors.muted, fontSize: 14, textAlign: 'center' },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16.5, fontWeight: '800', color: colors.navy, marginBottom: 5 },
  emptyText: { fontSize: 13.5, color: colors.muted, textAlign: 'center', lineHeight: 20 },

  card: { padding: 14, marginTop: 12 },
  cardTop: { flexDirection: 'row', gap: 13 },
  photo: { width: 92, height: 92, borderRadius: 16, backgroundColor: colors.grayBg },
  cardInfo: { flex: 1, minWidth: 0 },
  title: { fontSize: 16.5, fontWeight: '700', color: colors.navy, lineHeight: 21 },
  qty: { fontSize: 14, marginTop: 5 },
  qtyAvail: { fontWeight: '800', color: colors.navy },
  qtyTotal: { color: colors.muted },
  price: { fontSize: 15, fontWeight: '800', color: colors.green, marginTop: 5 },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  updated: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  updatedText: { fontSize: 12.5, color: colors.muted },
  cardActions: { flexDirection: 'row', gap: 9 },
});
