import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Button,
  QtyStepper,
  Sheet,
  TextArea,
  TextField,
  colors,
} from '../mobile';

interface ReserveSheetProps {
  visible: boolean;
  /** Quantity the caller may still reserve. */
  available: number;
  unit: string;
  currency: string;
  /** Item's listed price — shown as the offered-price placeholder. */
  price?: number | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (qty: number, price: number | null, message: string | null) => void;
}

const NUMERIC = /^\d*\.?\d*$/;

/**
 * Reserve sheet (prototype SHEETS.reserve) — bottom sheet with a qty stepper +
 * input, an "Available: N unit" helper, an offered price, and a message.
 * Validation: qty over the available amount or 0 → red input, red error line,
 * Request button disabled. Same onSubmit(qty, price, message) contract as the
 * web ReserveModal, so the screen wires it to the existing createReservation.
 */
export function ReserveSheet({
  visible,
  available,
  unit,
  currency,
  price: listedPrice,
  submitting = false,
  onClose,
  onSubmit,
}: ReserveSheetProps): React.JSX.Element {
  const [qty, setQty] = React.useState(0);
  const [price, setPrice] = React.useState('');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      setQty(0);
      setPrice('');
      setMessage('');
    }
  }, [visible]);

  const over = qty > available;
  const valid = qty > 0 && qty <= available;

  const pricePlaceholder =
    listedPrice === null || listedPrice === undefined
      ? 'Enter your price'
      : `${currency} ${listedPrice.toLocaleString()}/${unit} (listed price)`;

  const submit = (): void => {
    if (!valid || submitting) return;
    onSubmit(qty, price.trim() && NUMERIC.test(price) ? Number(price) : null, message.trim() || null);
  };

  return (
    <Sheet open={visible} onClose={onClose} title="Reserve quantity" description="Reserve directly here — no need to call.">
      <Text style={styles.label}>
        Quantity ({unit}) <Text style={styles.req}>*</Text>
      </Text>
      <QtyStepper value={qty} onChange={setQty} step={1} max={available} />
      {over ? (
        <Text style={styles.err}>
          Exceeds available quantity (max {available.toLocaleString()} {unit})
        </Text>
      ) : (
        <Text style={styles.help}>
          Available: {available.toLocaleString()} {unit}
        </Text>
      )}

      <View style={styles.gap} />
      <TextField
        label={`Your offered price (${currency} per ${unit})`}
        value={price}
        onChangeText={(t) => NUMERIC.test(t) && setPrice(t)}
        placeholder={pricePlaceholder}
        keyboardType="decimal-pad"
      />
      <TextArea
        label="Message — optional"
        value={message}
        onChangeText={setMessage}
        placeholder="Any special requirements…"
        autoCapitalize="sentences"
      />

      <Button
        label={submitting ? 'Sending…' : 'Request reservation'}
        variant="green"
        onPress={submit}
        disabled={!valid || submitting}
      />
      <View style={styles.gap} />
      <Button label="Cancel" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '800', color: colors.navy, marginBottom: 1 },
  req: { color: colors.red },
  help: { fontSize: 12.5, color: colors.muted, fontWeight: '600', marginTop: 6 },
  err: { fontSize: 12.5, color: colors.red, fontWeight: '700', marginTop: 6 },
  gap: { height: 10 },
});
