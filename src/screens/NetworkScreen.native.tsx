import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandLoader } from '../components/shared/BrandLoader';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList, RootStackParamList } from '../navigation';
import { getNetwork, type NetworkVendor } from '../services/supabase/network';
import { VendorSheet } from '../components/network/VendorSheet';
import { ImportSheet } from '../components/network/ImportSheet';
import { usePullRefresh } from '../hooks/usePullRefresh';
import {
  Avatar,
  Card,
  FabSpeedDial,
  Icon,
  NavBar,
  ScreenBackground,
  StatusBadge,
  colors,
  layout,
  spacing,
} from '../components/mobile';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Network'>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * Network (prototype SCREENS.network). Rule 8: a PUSHED screen reached from
 * Home's "My Network" tile — never a bottom tab — with a single "Network (n)"
 * underline tab and NO Pending tab.
 *
 * Bound to the existing getNetwork query. The FAB speed-dial adds vendors
 * manually (AddVendor screen) or via the Import sheet; tapping a vendor opens
 * the VendorSheet.
 */
export function NetworkScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = React.useState<NetworkVendor | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['network', 'list'],
    queryFn: getNetwork,
    staleTime: 60_000,
  });

  const { control: refreshControl } = usePullRefresh(refetch, insets.top + layout.navHeight - 56);

  const vendors = data ?? [];

  return (
    <ScreenBackground>
      <NavBar title="My Network" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {isLoading ? (
          <View style={styles.center}>
            <BrandLoader mode="loop" size={150} />
          </View>
        ) : (
          vendors.map((v: NetworkVendor) => (
            <Pressable key={v.row_id} onPress={() => setSelected(v)} style={({ pressed }) => pressed && styles.pressed}>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Avatar name={v.company_name} size={45} logoUrl={v.logo_url} />
                  <View style={styles.mid}>
                    <Text style={styles.name} numberOfLines={1}>
                      {v.company_name}
                    </Text>
                    {v.contact_person ? (
                      <Text style={styles.sub} numberOfLines={1}>
                        <Icon name="user" size={12} color={colors.placeholder} /> {v.contact_person}
                      </Text>
                    ) : null}
                  </View>
                  <StatusBadge status={v.status === 'connected' ? 'Connected' : v.is_manual ? 'Manual' : v.status} />
                </View>
                {v.city || v.country ? (
                  <View style={styles.locRow}>
                    <Icon name="loc" size={14} color={colors.placeholder} />
                    <Text style={styles.loc}>{[v.city, v.country].filter(Boolean).join(', ')}</Text>
                  </View>
                ) : null}
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      <FabSpeedDial
        actions={[
          { key: 'manual', label: 'Add manually', icon: 'user', onPress: () => navigation.navigate('AddVendor') },
          { key: 'import', label: 'Import contacts', icon: 'import', onPress: () => setImportOpen(true) },
        ]}
      />

      <VendorSheet
        vendor={selected}
        onClose={() => setSelected(null)}
        onEdit={(v) =>
          navigation.navigate('EditVendor', v.is_manual ? { manualVendorId: v.row_id } : { vendorId: v.vendor_id ?? undefined })
        }
      />

      <ImportSheet visible={importOpen} onClose={() => setImportOpen(false)} />
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
  pressed: { opacity: 0.85 },
});
