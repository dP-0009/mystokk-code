import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { webOnly } from '../layout/web';
import { colors, radius, shadows } from '../../theme/tokens';

interface ReserveModalProps {
  visible: boolean;
  /** Quantity the caller may still reserve. */
  available: number;
  unit: string;
  /** Display currency for the offered-price label. */
  currency: string;
  /** Item's listed price — shown as the offered-price placeholder. */
  price?: number | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (qty: number, price: number | null, message: string | null) => void;
}

const NUMERIC = /^\d*\.?\d*$/;

/** Currency code → symbol; unknown codes fall back to a "CODE " prefix. */
const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  AED: 'AED ',
};

/**
 * Offered-price placeholder: the item's listed price, e.g. "₹1,000,000/pcs
 * (listed price)". Falls back to "Enter your price" when no price is set.
 */
function offeredPricePlaceholder(currency: string, price: number | null | undefined, unit: string): string {
  if (price === null || price === undefined) return 'Enter your price';
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  return `${symbol}${price.toLocaleString()}/${unit} (listed price)`;
}

/**
 * Reserve Quantity modal (mirror `s-m-reserve`). Shown from the Received
 * Inventory Detail page to request a reservation against the available qty.
 */
export function ReserveModal({
  visible,
  available,
  unit,
  currency,
  price: listedPrice,
  submitting = false,
  onClose,
  onSubmit,
}: ReserveModalProps): React.JSX.Element {
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');

  // Start each open with a clean form.
  useEffect(() => {
    if (visible) {
      setQty('');
      setPrice('');
      setMessage('');
    }
  }, [visible]);

  const qtyNum = Number(qty);
  const overAvailable = NUMERIC.test(qty) && qty !== '' && qtyNum > available;
  const qtyValid = NUMERIC.test(qty) && qtyNum > 0 && qtyNum <= available;

  const step = (delta: number): void => {
    const next = Math.max(0, Math.min(available, Math.floor((Number(qty) || 0) + delta)));
    setQty(String(next));
  };

  const submit = (): void => {
    if (!qtyValid || submitting) return;
    onSubmit(qtyNum, price ? Number(price) : null, message.trim() || null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Reserve Quantity</Text>
            <Pressable style={styles.close} onPress={onClose} hitSlop={8} testID="reserve-close">
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.subtitle}>Reserve directly here - no need to call</Text>

            {/* Quantity */}
            <Text style={styles.label}>
              Quantity ({unit}) <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.qtyWrap, overAvailable ? styles.qtyWrapError : null]}>
              <TextInput
                style={styles.qtyInput}
                value={qty}
                onChangeText={(t) => NUMERIC.test(t) && setQty(t)}
                placeholder={`Max: ${available}`}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                autoFocus
                testID="reserve-qty"
              />
              <View style={styles.stepper}>
                <Pressable style={styles.stepBtn} onPress={() => step(1)} hitSlop={4} testID="reserve-qty-up">
                  <Ionicons name="chevron-up" size={14} color={colors.textSecondary} />
                </Pressable>
                <View style={styles.stepDivider} />
                <Pressable style={styles.stepBtn} onPress={() => step(-1)} hitSlop={4} testID="reserve-qty-down">
                  <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
            {overAvailable ? (
              <Text style={styles.qtyError}>
                Only {available.toLocaleString()} {unit} available to reserve.
              </Text>
            ) : (
              <Text style={styles.hint}>
                Available: {available.toLocaleString()} {unit}
              </Text>
            )}

            {/* Offered price */}
            <Text style={[styles.label, styles.labelSpaced]}>
              Your Offered Price ({currency} per {unit})
            </Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={(t) => NUMERIC.test(t) && setPrice(t)}
              placeholder={offeredPricePlaceholder(currency, listedPrice, unit)}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              testID="reserve-price"
            />

            {/* Message */}
            <Text style={[styles.label, styles.labelSpaced]}>Message (optional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Any special requirements..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              testID="reserve-message"
            />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.btnOutline} onPress={onClose} testID="reserve-cancel">
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btnGreen, !qtyValid || submitting ? styles.btnDisabled : null]}
              disabled={!qtyValid || submitting}
              onPress={submit}
              testID="reserve-submit"
            >
              <Text style={styles.btnGreenText}>Request Reservation</Text>
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
  subtitle: { fontSize: 12, color: colors.textSecondary, marginBottom: 16 },

  // Labels / inputs
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  labelSpaced: { marginTop: 16 },
  required: { color: colors.red },
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

  // Quantity — large input + stepper, soft border (no black box).
  qtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border, // #E2E8F0 — was near-black, which read as an ugly outline box
    borderRadius: radius.md,
    backgroundColor: colors.bgWhite,
    paddingLeft: 14,
    paddingRight: 6,
  },
  qtyWrapError: { borderColor: colors.red },
  qtyInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.textPrimary },
  stepper: { borderLeftWidth: 1, borderLeftColor: colors.border, marginLeft: 6 },
  stepBtn: { paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  stepDivider: { height: 1, backgroundColor: colors.border },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  qtyError: { fontSize: 11, fontWeight: '600', color: colors.red, marginTop: 6 },

  // `.mf`
  footer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnOutline: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: 'transparent',
  },
  btnOutlineText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  btnGreen: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.green, // #16A34A
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGreenText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
});
