import React from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { getItemDirectShares, revokeShare, type DirectShare } from '../services/supabase/shares';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { toast } from '../stores/toast';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageShares'>;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ManageSharesScreen({ navigation, route }: Props): React.JSX.Element {
  const { inventoryId } = route.params;
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['itemShares', inventoryId],
    queryFn: () => getItemDirectShares(inventoryId),
    staleTime: 15_000,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeShare,
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['itemShares', inventoryId] });
      queryClient.invalidateQueries({ queryKey: ['inventoryDetail', inventoryId] });
      toast(count > 1 ? `Revoked — ${count} shares pulled (incl. forwards)` : 'Share revoked');
      void refetch();
    },
    onError: (e) => Alert.alert('Could not revoke', e instanceof Error ? e.message : 'Try again.'),
  });

  const confirmRevoke = (item: DirectShare): void => {
    const who = item.recipient_company ?? 'this public link';
    Alert.alert(
      'Revoke access?',
      `${who} will immediately lose access, and any onward forwards from this share are revoked too.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => revokeMutation.mutate(item.share_id) },
      ],
    );
  };

  const renderItem = ({ item }: { item: DirectShare }): React.JSX.Element => {
    const revoked = item.status === 'revoked';
    const busy = revokeMutation.isPending && revokeMutation.variables === item.share_id;
    return (
      <View style={[styles.row, revoked ? styles.rowRevoked : null]}>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {item.recipient_company ?? '🔗 Public link'}
          </Text>
          <Text style={styles.meta}>Shared {fmtDate(item.created_at)}</Text>
        </View>
        {revoked ? (
          <View style={styles.revokedChip}>
            <Text style={styles.revokedChipText}>Revoked</Text>
          </View>
        ) : (
          <Pressable style={styles.revokeBtn} onPress={() => confirmRevoke(item)} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.red} size="small" />
            ) : (
              <Text style={styles.revokeText}>Revoke</Text>
            )}
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.fill}>
      <ScreenHeader title="Manage Shares" onBack={() => navigation.goBack()} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : 'Failed to load.'}</Text>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(s) => s.share_id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            (data?.length ?? 0) > 0 ? <Text style={styles.hint}>Direct shares of this item. Revoking also pulls any downstream forwards.</Text> : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Not shared yet</Text>
              <Text style={styles.emptySub}>Direct shares of this item will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  listContent: { padding: 16 },
  hint: { fontSize: 12, color: colors.slate500, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.slate100,
  },
  rowRevoked: { opacity: 0.6 },
  body: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  meta: { fontSize: 12, color: colors.slate500, marginTop: 2 },
  revokeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.redBg, minWidth: 78, alignItems: 'center' },
  revokeText: { color: colors.red, fontWeight: '700', fontSize: 13 },
  revokedChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.slate100 },
  revokedChipText: { fontSize: 11, fontWeight: '700', color: colors.slate500 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.slate900, marginBottom: 6 },
  emptySub: { fontSize: 13, color: colors.slate500, textAlign: 'center' },
});
