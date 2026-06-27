import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { NetworkVendor } from '../../services/supabase/network';
import { colors } from '../../theme/tokens';
import { webOnly } from '../layout/web';
import { VendorAvatar } from '../shared/VendorAvatar';
import { openWhatsApp } from '../../utils/contact';

interface ViewVendorModalProps {
  visible: boolean;
  vendor: NetworkVendor | null;
  onClose: () => void;
}

/** Read-only vendor details popup (spec STEP 2). */
export function ViewVendorModal({ visible, vendor, onClose }: ViewVendorModalProps): React.JSX.Element {
  const manual = vendor ? vendor.source === 'manual' && !vendor.is_registered : false;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          {vendor ? (
            <>
              {/* Identity */}
              <View style={styles.identity}>
                <VendorAvatar name={vendor.company_name} logoUrl={vendor.logo_url} size={64} />
                <Text style={styles.company} numberOfLines={2}>
                  {vendor.company_name}
                </Text>
                {vendor.contact_person ? <Text style={styles.contact}>{vendor.contact_person}</Text> : null}
                <View style={[styles.chip, manual ? styles.chipManual : styles.chipConnected]}>
                  <Text style={[styles.chipText, manual ? styles.chipTextManual : styles.chipTextConnected]}>
                    {manual ? 'Manual' : 'Connected'}
                  </Text>
                </View>
              </View>

              {/* Details */}
              <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                <DetailRow icon="mail-outline" label="Email" value={vendor.email} />
                <DetailRow icon="logo-whatsapp" label="Mobile / WhatsApp" value={vendor.mobile_number} />
                <DetailRow icon="location-outline" label="City" value={vendor.city} />
                <DetailRow icon="flag-outline" label="Country" value={vendor.country} />
                <DetailRow icon="briefcase-outline" label="Industry" value={vendor.industry} />
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                <Pressable style={styles.btnClose} onPress={onClose} testID="view-vendor-close">
                  <Text style={styles.btnCloseText}>Close</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnWa, !vendor.mobile_number ? styles.btnDisabled : null]}
                  disabled={!vendor.mobile_number}
                  onPress={() => openWhatsApp(vendor.mobile_number)}
                  testID="view-vendor-whatsapp"
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                  <Text style={styles.btnWaText}>Send Message on WhatsApp</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string | null;
}): React.JSX.Element | null {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} style={styles.detailIcon} />
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: colors.bgWhite,
    borderRadius: 24,
    overflow: 'hidden',
    ...webOnly({ maxHeight: '90vh' }),
  },

  identity: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 24, paddingBottom: 16, gap: 6 },
  company: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  contact: { fontSize: 13, color: colors.textSecondary },

  chip: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  chipConnected: { backgroundColor: colors.greenLight },
  chipManual: { backgroundColor: colors.accentLight },
  chipText: { fontSize: 12, fontWeight: '700' },
  chipTextConnected: { color: colors.green },
  chipTextManual: { color: colors.accent },

  body: { flexShrink: 1, borderTopWidth: 1, borderTopColor: colors.border },
  bodyContent: { padding: 24, gap: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailIcon: { marginTop: 2 },
  detailText: { flex: 1, minWidth: 0 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  detailValue: { fontSize: 14, color: colors.textPrimary, marginTop: 2 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnClose: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCloseText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  btnWa: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#25D366',
  },
  btnWaText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
});
