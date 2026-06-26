import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../navigation';
import { getReceivedShares } from '../services/supabase/received';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { ReceivedCard } from '../components/received/ReceivedCard';
import { EmptyState } from '../components/shared/EmptyState';
import { colors, radius } from '../theme/tokens';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Received'>,
  NativeStackScreenProps<RootStackParamList>
>;

const GRID_GAP = 10;

/** Two columns on desktop/tablet, single column on narrow screens. */
function columnsFor(width: number): number {
  return width >= 560 ? 2 : 1;
}

export function ReceivedListScreen({ navigation }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [gridWidth, setGridWidth] = useState(0);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['received'],
    queryFn: getReceivedShares,
    staleTime: 30_000,
  });

  useFocusEffect(
    React.useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const all = data ?? [];
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) =>
      [r.title, r.shared_by_company_name, r.category, r.product_code].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [all, search]);

  const cols = columnsFor(gridWidth || 900);
  const cardWidth = gridWidth > 0 ? (gridWidth - GRID_GAP * (cols - 1)) / cols : undefined;
  const onGridLayout = (e: LayoutChangeEvent): void => setGridWidth(e.nativeEvent.layout.width);

  return (
    <MainLayout active="received">
      <PageHeader
        title="Received Inventory"
        subtitle={`${all.length} item${all.length === 1 ? '' : 's'} shared with you`}
      />

      <PageBody>
        {/* Search bar — full width */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={14} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title or vendor..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            testID="received-search"
          />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Failed to load.'}</Text>
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon="📥"
            title={search ? 'No matching items' : 'Nothing received yet'}
            message={
              search
                ? 'Try a different search.'
                : 'Items shared with you appear here. Build your network so vendors can share their stock.'
            }
            ctaLabel={search ? undefined : 'Go to Network'}
            onCta={search ? undefined : () => navigation.navigate('Network')}
            testID="received-empty"
          />
        ) : (
          <View style={styles.grid} onLayout={onGridLayout}>
            {items.map((item) => (
              <View key={item.share_id} style={cardWidth ? { width: cardWidth } : styles.cardFull}>
                <ReceivedCard
                  item={item}
                  onPress={() => navigation.navigate('ReceivedDetail', { shareId: item.share_id })}
                />
              </View>
            ))}
          </View>
        )}
      </PageBody>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  // Full-width search (mirror `.sw input`)
  searchWrap: { justifyContent: 'center', marginBottom: 16 },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  searchInput: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 38,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.bgWhite,
  },

  // 2-column grid, gap 10
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  cardFull: { width: '100%' },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
