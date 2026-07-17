import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getItemDirectShares, revokeShare, type DirectShare } from '../../services/supabase/shares';
import { toast } from '../../stores/toast';
import { Avatar, Button, Icon, Sheet, colors, spacing } from '../mobile';

interface ManageSharesSheetProps {
  open: boolean;
  onClose: () => void;
  inventoryId: string;
  /** Opens the full share flow ("Share with More"). */
  onShareMore: () => void;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

/**
 * Manage Shares — the owner's direct shares of one item, as a native bottom
 * sheet (plain RN Modal via <Sheet/>). Same server-scoped data + revoke as the
 * web popup: getItemDirectShares / revokeShare. Each row revokes behind a
 * two-tap confirm (cascading to its downstream forwards); "Share with More"
 * opens the existing share flow.
 */
export function ManageSharesSheet({ open, onClose, inventoryId, onShareMore }: ManageSharesSheetProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['itemShares', inventoryId],
    queryFn: () => getItemDirectShares(inventoryId),
    staleTime: 15_000,
    enabled: open,
  });
  const shares = (data ?? []).filter((s) => s.status !== 'revoked');

  const revoke = useMutation({
    mutationFn: revokeShare,
    onSuccess: (count) => {
      setConfirmingId(null);
      void queryClient.invalidateQueries({ queryKey: ['itemShares', inventoryId] });
      void queryClient.invalidateQueries({ queryKey: ['inventoryDetail', inventoryId] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(count > 1 ? `Revoked — ${count} shares pulled (incl. forwards)` : 'Share revoked');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not revoke.'),
  });

  const onRevoke = (s: DirectShare): void => {
    if (confirmingId === s.share_id) revoke.mutate(s.share_id);
    else setConfirmingId(s.share_id);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Manage Shares"
      description="Your network remains private. Control who has access."
      fitContent
    >
      {isLoading ? (
        <ActivityIndicator color={colors.blue} style={styles.loading} />
      ) : shares.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Not shared yet</Text>
          <Text style={styles.emptySub}>People you share this item with will appear here.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {shares.map((s) => {
            const isPublic = s.recipient_id === null;
            const name = isPublic ? 'Public link' : s.recipient_company ?? 'A vendor';
            const confirming = confirmingId === s.share_id;
            const busy = revoke.isPending && revoke.variables === s.share_id;
            return (
              <View key={s.share_id} style={styles.row}>
                {isPublic ? (
                  <View style={styles.linkIcon}>
                    <Icon name="open" size={20} color={colors.blue} />
                  </View>
                ) : (
                  <Avatar name={s.recipient_company ?? 'A vendor'} size={44} />
                )}
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {name}
                  </Text>
                  {s.recipient_email ? (
                    <Text style={styles.email} numberOfLines={1}>
                      {s.recipient_email}
                    </Text>
                  ) : null}
                  <Text style={styles.date}>Shared {fmtDate(s.created_at)}</Text>
                </View>
                <Pressable
                  style={[styles.revoke, confirming && styles.revokeConfirm]}
                  onPress={() => onRevoke(s)}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.red} size="small" />
                  ) : (
                    <>
                      <Icon name="shield" size={14} color={confirming ? '#FFFFFF' : colors.red} />
                      <Text style={[styles.revokeText, confirming && styles.revokeTextConfirm]}>
                        {confirming ? 'Confirm' : 'Revoke'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.footer}>
        <Button label="Close" variant="ghost" onPress={onClose} style={styles.footerBtn} />
        <Button
          label="Share with More"
          variant="dark"
          icon={<Icon name="share" size={17} color="#FFFFFF" />}
          onPress={onShareMore}
          style={styles.footerBtn}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: 28 },
  empty: { paddingVertical: 26, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15.5, fontWeight: '800', color: colors.navy },
  emptySub: { fontSize: 13, color: colors.muted, textAlign: 'center' },

  list: { gap: 10, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
  },
  linkIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ice, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14.5, fontWeight: '800', color: colors.navy },
  email: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  date: { fontSize: 11.5, color: colors.placeholder, marginTop: 3 },

  revoke: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 92,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(217,48,48,0.28)',
    backgroundColor: colors.redBg,
  },
  revokeConfirm: { backgroundColor: colors.red, borderColor: colors.red },
  revokeText: { fontSize: 13, fontWeight: '800', color: colors.red },
  revokeTextConfirm: { color: '#FFFFFF' },

  footer: { flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: spacing.xs },
  footerBtn: { flex: 1 },
});
