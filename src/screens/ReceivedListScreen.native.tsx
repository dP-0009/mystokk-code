import React from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { BrandLoader } from '../components/shared/BrandLoader';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../navigation';
import { getReceivedShares, type ReceivedListItem } from '../services/supabase/received';
import { usePullRefresh } from '../hooks/usePullRefresh';
import { useReceivedSeen } from '../stores/receivedSeen';
import { useAuthStore } from '../stores/authStore';
import {
  Card,
  EmptyState,
  GlassPanel,
  Icon,
  ScreenBackground,
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
  BottomTabScreenProps<MainTabParamList, 'Received'>,
  NativeStackScreenProps<RootStackParamList>
>;

function priceLabel(item: ReceivedListItem): string {
  if (item.display_price === null) return 'Price on request';
  return `${item.display_currency ?? ''} ${item.display_price.toLocaleString()}/${item.unit}`.trim();
}

/**
 * Received tab (prototype SCREENS.received). Bound to the existing
 * getReceivedShares query. Cards have NO Edit chip — editing happens from the
 * detail screen (item 1).
 */
export function ReceivedListScreen({ navigation }: Props): React.JSX.Element {
  const bottomPad = useTabBarSpace();
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['received'],
    queryFn: getReceivedShares,
    staleTime: 30_000,
  });

  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const userId = useAuthStore((s) => s.session?.user.id);
  const markSeen = useReceivedSeen((s) => s.markSeen);

  useFocusEffect(
    React.useCallback(() => {
      void refetch();
      // Opening the tab clears its "new items" badge.
      if (userId) void markSeen(userId);
    }, [refetch, userId, markSeen]),
  );

  const all = data ?? [];
  const items = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) =>
      [r.title, r.shared_by_company_name, r.category, r.product_code].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [all, search]);

  return (
    <ScreenBackground>
      <TabHeader
        title="Received Inventory"
        subtitle={`${all.length} item${all.length === 1 ? '' : 's'} shared with you`}
      />

      {isLoading ? (
        <View style={styles.center}>
          <BrandLoader mode="loop" size={150} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Failed to load.'}</Text>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(it) => it.share_id}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <GlassPanel effect="clear" radius={radii.row} fill={glass.fillInput} style={styles.searchPill}>
                <Icon name="search" size={18} color={colors.muted} />
                <TextInput
                  value={searchInput}
                  onChangeText={setSearchInput}
                  placeholder="Search by title or vendor…"
                  placeholderTextColor={colors.placeholder}
                  style={styles.searchInput}
                  autoCorrect={false}
                />
              </GlassPanel>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <EmptyState
              icon="inbox"
              title={search ? 'No matching items' : 'Nothing received yet'}
              message={
                search
                  ? 'Try a different search.'
                  : 'Items shared with you appear here. Build your network so vendors can share their stock.'
              }
            />
          }
          renderItem={({ item }) => (
            <ReceivedItemCard
              item={item}
              onPress={() => navigation.navigate('ReceivedDetail', { shareId: item.share_id })}
            />
          )}
        />
      )}
    </ScreenBackground>
  );
}

/** One received card (prototype SCREENS.received card). */
function ReceivedItemCard({ item, onPress }: { item: ReceivedListItem; onPress: () => void }): React.JSX.Element {
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.cardTop}>
        {item.thumbUrl ? (
          <Image source={{ uri: item.thumbUrl }} style={styles.photo} />
        ) : (
          <Thumb name={item.title} size={92} radius={16} />
        )}
        <View style={styles.info}>
          {/* Title with 2-line clamp — NO location line. */}
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

      <View style={styles.footer}>
        <Text style={styles.from}>
          From: <Text style={styles.fromName}>{item.shared_by_company_name ?? 'A vendor'}</Text>
        </Text>
        <View style={styles.time}>
          <Icon name="clock" size={13} color={colors.placeholder} />
          <Text style={styles.timeText}>{relativeTimeShort(item.created_at)}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerBlock: { paddingTop: 14, paddingBottom: 2 },
  searchPill: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 45, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { color: colors.muted, fontSize: 14, textAlign: 'center' },

  card: { padding: 14, marginTop: 12 },
  cardTop: { flexDirection: 'row', gap: 13 },
  photo: { width: 92, height: 92, borderRadius: 16, backgroundColor: colors.grayBg },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 16.5, fontWeight: '700', color: colors.navy, lineHeight: 21 },
  qty: { fontSize: 14, marginTop: 4 },
  qtyAvail: { fontWeight: '800', color: colors.navy },
  qtyTotal: { color: colors.muted },
  price: { fontSize: 15, fontWeight: '800', color: colors.green, marginTop: 4 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  from: { fontSize: 13.5, color: colors.muted },
  fromName: { fontWeight: '800', color: colors.navy },
  time: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: 12.5, color: colors.muted },
});
