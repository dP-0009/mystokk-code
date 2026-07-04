import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
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
import { ErrorState, LoadingState } from '../components/shared/StateView';
import { colors, radius } from '../theme/tokens';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Received'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function ReceivedListScreen({ navigation }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');

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
          <LoadingState />
        ) : isError ? (
          <ErrorState
            message={error instanceof Error ? error.message : 'Failed to load.'}
            onRetry={() => void refetch()}
          />
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
          <View style={styles.list}>
            {items.map((item) => (
              <ReceivedCard
                key={item.share_id}
                item={item}
                onPress={() => navigation.navigate('ReceivedDetail', { shareId: item.share_id })}
              />
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

  // Responsive multi-column grid — cards wrap and fill ~3 across on desktop,
  // collapsing to 2 / 1 as the viewport narrows (min card width 320).
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },

});
