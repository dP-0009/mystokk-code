import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { webOnly } from '../layout/web';
import { colors, radius, shadows } from '../../theme/tokens';

interface PreShareModalProps {
  visible: boolean;
  /** Display currency + unit for the price label, e.g. "AED per cubic meters". */
  currency: string;
  unit: string;
  onClose: () => void;
  /** Continue into the forward Share modal with the chosen price/remark. */
  onContinue: (price: number | null, remark: string | null) => void;
}

const NUMERIC = /^\d*\.?\d*$/;

/**
 * Pre-Share / Forward gate (mirror `s-m-pre-share`). Shown from the Received
 * Inventory Detail page before forwarding: the original supplier's price is
 * never forwarded, so the forwarder sets their own optional price + remark here.
 */
export function PreShareModal({ visible, currency, unit, onClose, onContinue }: PreShareModalProps): React.JSX.Element {
  const [price, setPrice] = useState('');
  const [remark, setRemark] = useState('');

  const close = (): void => {
    setPrice('');
    setRemark('');
    onClose();
  };

  const cont = (): void => {
    onContinue(price ? Number(price) : null, remark.trim() || null);
    setPrice('');
    setRemark('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>⤴ Share with your network</Text>
            <Pressable style={styles.close} onPress={close} hitSlop={8} testID="pre-share-close">
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                The original supplier's price will <Text style={styles.warnBold}>not</Text> be forwarded. Set your
                own price (optional) and a remark before sharing.
              </Text>
            </View>

            <Text style={styles.label}>
              Your Price ({currency} per {unit}) — optional
            </Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={(t) => NUMERIC.test(t) && setPrice(t)}
              placeholder="Leave blank to share without price"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              autoFocus
              testID="pre-share-price"
            />

            <Text style={[styles.label, styles.labelSpaced]}>Remark — optional</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={remark}
              onChangeText={setRemark}
              placeholder="e.g. MOQ 100 units, ready stock, lead time 2 weeks..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              testID="pre-share-remark"
            />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.btnOutline} onPress={close} testID="pre-share-cancel">
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.btnDark} onPress={cont} testID="pre-share-continue">
              <Text style={styles.btnDarkText}>Continue</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // `.mo`
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // `.md` (max-width 440)
  card: {
    backgroundColor: colors.bgWhite,
    borderRadius: radius.xl,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    overflow: 'hidden',
    ...shadows.lg,
    ...webOnly({ maxHeight: '90vh' }),
  },

  // `.mh`
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgChip,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  closeText: { fontSize: 16, color: colors.textSecondary },

  // `.mb`
  body: { flexShrink: 1 },
  bodyContent: { paddingHorizontal: 24, paddingVertical: 20 },

  // `.wb`
  warnBox: {
    backgroundColor: colors.yellowLight,
    borderWidth: 1,
    borderColor: colors.yellowBorder,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  warnText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  warnBold: { fontWeight: '700', color: '#92400E' },

  // `.fg` / `.fl` / `.fi`
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  labelSpaced: { marginTop: 16 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.bgWhite,
  },
  textarea: { minHeight: 80, ...webOnly({ resize: 'vertical' }) },

  // `.mf` — two half-width buttons
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnOutline: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  btnOutlineText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  btnDark: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.primary, // #0F172A
    alignItems: 'center',
  },
  btnDarkText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
});
