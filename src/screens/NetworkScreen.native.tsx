import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../navigation';
import { getNetwork, type NetworkVendor } from '../services/supabase/network';
import {
  Avatar,
  Card,
  Icon,
  NavBar,
  ScreenBackground,
  UnderlineTabs,
  colors,
  layout,
  spacing,
} from '../components/mobile';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Network'>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * Network — NATIVE PLACEHOLDER (prototype SCREENS.network, minus the sheets/FAB
 * that Phase 7 will add). Rule 8: this is a PUSHED screen reached from Home's
 * "My Network" tile — never a bottom tab — with a single "Network (n)" underline
 * tab and NO Pending tab.
 *
 * Bound to the existing getNetwork query; presentation only. Full add/import/
 * vendor-sheet behaviour lands in Phase 7.
 */
export function NetworkScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ['network', 'list'],
    queryFn: getNetwork,
    staleTime: 60_000,
  });

  const vendors = data ?? [];

  return (
    <ScreenBackground>
      <NavBar title="My Network" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Single underline tab, no Pending pane (rule 8). */}
        <UnderlineTabs
          tabs={[{ key: 'network', label: 'Network', count: vendors.length }]}
          value="network"
          onChange={() => undefined}
        />

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.blue} size="large" />
          </View>
        ) : (
          vendors.map((v: NetworkVendor) => (
            <Card key={v.row_id} style={styles.card}>
              <View style={styles.row}>
                <Avatar name={v.company_name} size={45} />
                <View style={styles.mid}>
                  <Text style={styles.name} numberOfLines={1}>
                    {v.company_name}
                  </Text>
                  {v.contact_person ? (
                    <Text style={styles.sub} numberOfLines={1}>
                      {v.contact_person}
                    </Text>
                  ) : null}
                </View>
              </View>
              {v.city || v.country ? (
                <View style={styles.locRow}>
                  <Icon name="loc" size={14} color={colors.placeholder} />
                  <Text style={styles.loc}>{[v.city, v.country].filter(Boolean).join(', ')}</Text>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.gutter },
  center: { paddingVertical: 80, alignItems: 'center' },
  card: { padding: 15, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mid: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, fontWeight: '700', color: colors.navy },
  sub: { fontSize: 12.5, color: colors.muted, marginTop: 4 },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  loc: { fontSize: 12.5, color: colors.muted },
});
