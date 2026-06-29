import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getForwardShares, getItemDirectShares, revokeShare, type DirectShare } from '../../services/supabase/shares';
import { VendorAvatar } from '../shared/VendorAvatar';
import { webOnly } from '../layout/web';
import { toast } from '../../stores/toast';
import { colors } from '../../theme/tokens';

interface ManageSharesModalProps {
  visible: boolean;
  onClose: () => void;
  /** Open the full share / forward flow ("Share with More"). */
  onShareMore: () => void;
  /** Owner mode — manage the owner's own direct shares of this item. */
  inventoryId?: string;
  /**
   * Forward mode — manage the forwards the CURRENT user made from this received
   * share. Privacy-scoped server-side, so only the caller's own recipients show
   * (never the upstream owner's or other forwarders'). Supply this OR inventoryId.
   */
  parentShareId?: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

/**
 * "Manage Shares" popup — who the OWNER has shared this item with. The list is
 * owner-scoped on the server (only the caller's own direct shares), so a
 * recipient can never see who else an item was shared with, and forwards a
 * recipient makes never appear here. Each row can be revoked (cascading to its
 * downstream forwards); "Share with More" opens the full share flow.
 */
export function ManageSharesModal({
  visible,
  inventoryId,
  parentShareId,
  onClose,
  onShareMore,
}: ManageSharesModalProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Forward mode lists the caller's own forwards from a received share; owner
  // mode lists the owner's direct shares of an item.
  const forwardMode = parentShareId != null;

  const { data, isLoading } = useQuery({
    queryKey: forwardMode ? ['forwardShares', parentShareId] : ['itemShares', inventoryId],
    queryFn: () => (forwardMode ? getForwardShares(parentShareId) : getItemDirectShares(inventoryId ?? '')),
    staleTime: 15_000,
    enabled: visible,
  });
  const shares = (data ?? []).filter((s) => s.status !== 'revoked');

  const revokeMutation = useMutation({
    mutationFn: revokeShare,
    onSuccess: (count) => {
      setConfirmingId(null);
      if (forwardMode) {
        void queryClient.invalidateQueries({ queryKey: ['forwardShares', parentShareId] });
        void queryClient.invalidateQueries({ queryKey: ['receivedDetail', parentShareId] });
      } else {
        void queryClient.invalidateQueries({ queryKey: ['itemShares', inventoryId] });
        void queryClient.invalidateQueries({ queryKey: ['inventoryDetail', inventoryId] });
        void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      }
      toast.success(count > 1 ? `Revoked — ${count} shares pulled (incl. forwards)` : 'Share revoked');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not revoke.'),
  });

  const title = forwardMode ? 'Shared With' : 'Manage Shares';
  const subtitle = forwardMode
    ? 'Only the people you forwarded this to. Your upstream network stays private.'
    : 'Your network remains private. Control who has access.';
  const emptySub = forwardMode
    ? "People you forward this item to will appear here."
    : 'People you share this item with will appear here.';
  const shareMoreLabel = forwardMode ? 'Forward to More' : 'Share with More';

  const onRevoke = (item: DirectShare): void => {
    if (confirmingId === item.share_id) revokeMutation.mutate(item.share_id);
    else setConfirmingId(item.share_id);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Ionicons name="people-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* List */}
          {isLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : shares.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Not shared yet</Text>
              <Text style={styles.emptySub}>{emptySub}</Text>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {shares.map((s) => {
                const isPublic = s.recipient_id === null;
                const name = isPublic ? 'Public link' : s.recipient_company ?? 'A vendor';
                const confirming = confirmingId === s.share_id;
                const busy = revokeMutation.isPending && revokeMutation.variables === s.share_id;
                return (
                  <View key={s.share_id} style={styles.row}>
                    {isPublic ? (
                      <View style={styles.linkIcon}>
                        <Ionicons name="link" size={18} color={colors.accent} />
                      </View>
                    ) : (
                      <VendorAvatar name={s.recipient_company} email={s.recipient_email} size={44} />
                    )}
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {name}
                      </Text>
                      {s.recipient_email ? (
                        <Text style={styles.rowEmail} numberOfLines={1}>
                          {s.recipient_email}
                        </Text>
                      ) : null}
                      <Text style={styles.rowDate}>Shared {fmtDate(s.created_at)}</Text>
                    </View>
                    <Pressable
                      style={[styles.revokeBtn, confirming ? styles.revokeBtnConfirm : null, webOnly({ cursor: 'pointer' })]}
                      onPress={() => onRevoke(s)}
                      disabled={busy}
                    >
                      {busy ? (
                        <ActivityIndicator color={colors.red} size="small" />
                      ) : (
                        <>
                          <Ionicons
                            name={confirming ? 'alert-circle-outline' : 'shield-outline'}
                            size={14}
                            color={confirming ? colors.bgWhite : colors.red}
                          />
                          <Text style={[styles.revokeText, confirming ? styles.revokeTextConfirm : null]}>
                            {confirming ? 'Confirm' : 'Revoke'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={[styles.btn, styles.btnGhost, webOnly({ cursor: 'pointer' })]} onPress={onClose}>
              <Text style={styles.btnGhostText}>Close</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary, webOnly({ cursor: 'pointer' })]} onPress={onShareMore}>
              <Ionicons name="share-social-outline" size={15} color={colors.bgWhite} />
              <Text style={styles.btnPrimaryText}>{shareMoreLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    backgroundColor: colors.bgWhite,
    borderRadius: 20,
    padding: 24,
    ...webOnly({ maxHeight: '85vh' }),
  },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6, marginBottom: 16 },

  loading: { marginVertical: 24 },
  empty: { paddingVertical: 28, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  list: { flexShrink: 1 },
  listContent: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  linkIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.2 },
  rowEmail: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  rowDate: { fontSize: 11.5, color: colors.textMuted, marginTop: 3 },

  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: colors.redLight,
    minWidth: 96,
    justifyContent: 'center',
  },
  revokeBtnConfirm: { backgroundColor: colors.red, borderColor: colors.red },
  revokeText: { fontSize: 13, fontWeight: '700', color: colors.red },
  revokeTextConfirm: { color: colors.bgWhite },

  footer: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  btnGhost: { borderWidth: 1.5, borderColor: colors.borderDark, backgroundColor: colors.bgWhite },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: colors.bgWhite },
});
