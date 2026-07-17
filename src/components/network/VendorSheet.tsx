import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { removeNetworkVendor, type NetworkVendor } from '../../services/supabase/network';
import { confirmAction } from '../../utils/confirm';
import { toast } from '../../stores/toast';
import {
  Avatar,
  Button,
  GlassPanel,
  Icon,
  KeyValue,
  Sheet,
  StatusBadge,
  WhatsAppLogo,
  colors,
  glass,
  radii,
} from '../mobile';

interface VendorSheetProps {
  vendor: NetworkVendor | null;
  onClose: () => void;
  onEdit: (vendor: NetworkVendor) => void;
}

/** Digits-only phone for tel:/wa.me. */
function digits(phone: string | null): string {
  return (phone ?? '').replace(/[^\d]/g, '');
}

/**
 * Vendor sheet (prototype SHEETS.vendor) — centered avatar/name/status, a KV
 * card (email, mobile, city, industry), Call / WhatsApp / Email via Linking with
 * the real contact data, and Edit / Delete. Delete uses the existing
 * removeNetworkVendor mutation behind a confirm.
 */
export function VendorSheet({ vendor, onClose, onEdit }: VendorSheetProps): React.JSX.Element {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => {
      if (!vendor) throw new Error('No vendor');
      return removeNetworkVendor(vendor.source, vendor.row_id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Vendor removed');
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not remove vendor.'),
  });

  const confirmDelete = (): void => {
    if (!vendor) return;
    confirmAction({
      title: 'Remove vendor?',
      message: `${vendor.company_name} will be removed from your network.`,
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => remove.mutate(),
    });
  };

  const phone = vendor?.mobile_number ?? null;
  const email = vendor?.email ?? null;

  return (
    <Sheet open={vendor !== null} onClose={onClose} fitContent>
      {vendor ? (
        <>
          <View style={styles.head}>
            <Avatar name={vendor.company_name} size={74} gradient="nav" logoUrl={vendor.logo_url} />
            <Text style={styles.name}>{vendor.company_name}</Text>
            <View style={styles.statusRow}>
              {vendor.contact_person ? <Text style={styles.contact}>{vendor.contact_person} · </Text> : null}
              <StatusBadge status={vendor.status === 'connected' ? 'Connected' : vendor.is_manual ? 'Manual' : vendor.status} />
            </View>
          </View>

          <GlassPanel radius={radii.card} fill={glass.fillInput} style={styles.kvCard}>
            <KeyValue label="Email" value={email ?? '—'} />
            <KeyValue label="Mobile / WhatsApp" value={phone ?? '—'} />
            <KeyValue label="City" value={[vendor.city, vendor.country].filter(Boolean).join(', ') || '—'} />
            <KeyValue label="Industry" value={vendor.industry ?? '—'} last />
          </GlassPanel>

          <View style={styles.contactRow}>
            <Button
              label=""
              variant="ghost"
              icon={<Icon name="phone" size={18} color={colors.navy} />}
              onPress={() => phone && Linking.openURL(`tel:${phone}`)}
              disabled={!phone}
              style={styles.contactBtn}
            />
            <Button
              label="WhatsApp"
              variant="green"
              icon={<WhatsAppLogo size={18} variant="glyph" />}
              onPress={() => phone && Linking.openURL(`https://wa.me/${digits(phone)}`)}
              disabled={!phone}
              style={styles.waBtn}
            />
            <Button
              label=""
              variant="ghost"
              icon={<Icon name="mail" size={18} color={colors.navy} />}
              onPress={() => email && Linking.openURL(`mailto:${email}`)}
              disabled={!email}
              style={styles.contactBtn}
            />
          </View>

          <View style={styles.editRow}>
            <Button
              label="Edit"
              variant="ghost"
              size="sm"
              icon={<Icon name="edit" size={16} color={colors.navy} />}
              onPress={() => {
                const v = vendor;
                onClose();
                onEdit(v);
              }}
              style={styles.editBtn}
            />
            <Button
              label="Delete"
              variant="danger"
              size="sm"
              icon={<Icon name="trash" size={16} color={colors.red} />}
              onPress={confirmDelete}
              disabled={remove.isPending}
              style={styles.editBtn}
            />
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', paddingTop: 4 },
  name: { fontSize: 19, fontWeight: '800', color: colors.navy, marginTop: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 6 },
  contact: { fontSize: 13.5, color: colors.muted },
  kvCard: { paddingHorizontal: 16, paddingVertical: 4, marginTop: 10, marginBottom: 14 },
  contactRow: { flexDirection: 'row', gap: 10 },
  contactBtn: { flex: 1 },
  waBtn: { flex: 2 },
  editRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  editBtn: { flex: 1 },
});
