import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../navigation';
import { deleteInventory, listInventory, type InventoryListItem } from '../services/supabase/inventory';
import { INVENTORY_FILTERS, type InventoryStatus } from '../constants/inventory';
import { colors, radius, shadows } from '../theme/tokens';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { InventoryCard } from '../components/inventory/InventoryCard';
import { ShareModal } from '../components/share/ShareModal';
import { confirmAction } from '../utils/confirm';
import { toast } from '../stores/toast';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Inventory'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function InventoryListScreen({ navigation }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<InventoryStatus | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  // The item whose Share modal is open (over the list — no navigation).
  const [shareItem, setShareItem] = useState<InventoryListItem | null>(null);

  // Debounce the search input.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventory', filter, search],
    queryFn: () => listInventory(filter, search),
    staleTime: 30_000,
  });

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
    setOpenMenuId(null);
    confirmAction({
      title: 'Delete item?',
      message: `“${item.title}” will be permanently removed.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deleteMutation.mutate(item.inventory_id),
    });
  };

  // Refresh when returning to the tab (e.g. after creating/editing an item).
  useFocusEffect(
    React.useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const items = data ?? [];

  return (
    <MainLayout active="inventory">
      <PageHeader
        title="My Inventory"
        subtitle={`${items.length} item${items.length === 1 ? '' : 's'}`}
      />

      <PageBody>
        {/* Right-aligned action, sitting directly below the fixed bell icon. */}
        <View style={styles.actionRow}>
          <Pressable style={styles.addBtn} onPress={() => navigation.navigate('InventoryCreate')}>
            <Ionicons name="add" size={16} color={colors.bgWhite} />
            <Text style={styles.addBtnText}>Add Item</Text>
          </Pressable>
        </View>

        {/* Filter bar */}
        <View style={styles.filterBar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={13} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search items..."
              placeholderTextColor={colors.textMuted}
              value={searchInput}
              onChangeText={setSearchInput}
              autoCorrect={false}
            />
          </View>
          <StatusSelect value={filter} onChange={setFilter} />
        </View>

        {/* Grid */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>
              {error instanceof Error ? error.message : 'Failed to load.'}
            </Text>
          </View>
        ) : items.length === 0 ? (
          <Text style={styles.empty}>
            {search ? 'No items match your search.' : 'No items yet — add your first item.'}
          </Text>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <InventoryCard
                key={item.inventory_id}
                item={item}
                onPress={() => navigation.navigate('InventoryDetail', { inventoryId: item.inventory_id })}
                onShare={() => setShareItem(item)}
                menuOpen={openMenuId === item.inventory_id}
                onMenuToggle={() =>
                  setOpenMenuId((cur) => (cur === item.inventory_id ? null : item.inventory_id))
                }
                onMenuClose={() => setOpenMenuId(null)}
                onView={() => navigation.navigate('InventoryDetail', { inventoryId: item.inventory_id })}
                onEdit={() => navigation.navigate('InventoryEdit', { inventoryId: item.inventory_id })}
                onDelete={() => confirmDelete(item)}
              />
            ))}
          </View>
        )}
      </PageBody>

      {/* Share modal — opens over the list from a card's share icon (no navigation). */}
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
    </MainLayout>
  );
}

/** Compact 'All Status' dropdown for the filter bar (mirror `.fsel`). */
function StatusSelect({
  value,
  onChange,
}: {
  value: InventoryStatus | null;
  onChange: (status: InventoryStatus | null) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const label = value === null ? 'All Status' : INVENTORY_FILTERS.find((f) => f.status === value)?.label ?? 'All Status';

  return (
    <View style={styles.selectWrap}>
      <Pressable style={styles.select} onPress={() => setOpen((o) => !o)}>
        <Text style={styles.selectText}>{label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.dropdown}>
          {INVENTORY_FILTERS.map((f) => {
            const active = f.status === value;
            return (
              <Pressable
                key={f.label}
                style={styles.option}
                onPress={() => {
                  onChange(f.status);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: 8 },

  // Body action row — right-aligned, lines up under the fixed bell icon.
  actionRow: { alignItems: 'flex-end', marginBottom: 16 },
  // `.btn-p` — dark navy primary button.
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  addBtnText: { color: colors.bgWhite, fontSize: 13, fontWeight: '600' },

  // `.fbar`
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    zIndex: 10, // keep the status dropdown above the grid
  },
  // `.sw`
  searchWrap: { flex: 1, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  // `.sw input`
  searchInput: {
    width: '100%',
    paddingTop: 9,
    paddingBottom: 9,
    paddingLeft: 36,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.bgWhite,
  },

  // `.fsel`
  selectWrap: { position: 'relative', zIndex: 1000 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgWhite,
  },
  selectText: { fontSize: 13, color: colors.textPrimary },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    minWidth: 180,
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border, // #E2E8F0
    borderRadius: radius.md, // 10
    paddingVertical: 4,
    overflow: 'visible',
    zIndex: 9999,
    ...shadows.dropdown,
  },
  option: { paddingVertical: 9, paddingHorizontal: 12 },
  optionText: { fontSize: 13, color: colors.textSecondary },
  optionTextActive: { color: colors.accent, fontWeight: '600' },

  // Full-width single-column card list.
  // Responsive multi-column grid — cards wrap ~3 across on desktop, 2 / 1 narrower.
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
});
