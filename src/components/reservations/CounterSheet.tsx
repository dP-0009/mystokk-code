import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Sheet, TextField } from '../mobile';

interface CounterSheetProps {
  visible: boolean;
  /** The round being sent now (1-based). */
  round: number;
  maxRounds: number;
  currency: string;
  unit: string;
  /** Prefill for the quantity field (usually the current requested qty). */
  defaultQty: number;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (price: number, qty: number, note: string | null) => void;
}

const NUMERIC = /^\d*\.?\d*$/;

/**
 * Counter sheet (prototype SHEETS.counter) — price + quantity + optional note,
 * with a "Round n of 3" indicator. The backend enforces the 3-round cap; this
 * just disables Send once the cap is reached.
 */
export function CounterSheet({
  visible,
  round,
  maxRounds,
  currency,
  unit,
  defaultQty,
  submitting = false,
  onClose,
  onSubmit,
}: CounterSheetProps): React.JSX.Element {
  const [price, setPrice] = React.useState('');
  const [qty, setQty] = React.useState(String(defaultQty));
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      setPrice('');
      setQty(String(defaultQty));
      setNote('');
    }
  }, [visible, defaultQty]);

  const capReached = round > maxRounds;
  const valid = !capReached && price.trim() !== '' && NUMERIC.test(price) && Number(price) > 0;

  const submit = (): void => {
    if (!valid || submitting) return;
    onSubmit(Number(price), Number(qty || defaultQty), note.trim() || null);
  };

  return (
    <Sheet
      open={visible}
      onClose={onClose}
      title="Counter offer"
      description={capReached ? 'You have used all negotiation rounds.' : `Round ${round} of ${maxRounds}`}
    >
      <View style={styles.row}>
        <View style={styles.col}>
          <TextField
            label={`Your price (${currency})`}
            value={price}
            onChangeText={(t) => NUMERIC.test(t) && setPrice(t)}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.col}>
          <TextField
            label={`Quantity (${unit})`}
            value={qty}
            onChangeText={(t) => NUMERIC.test(t) && setQty(t)}
            placeholder="0"
            keyboardType="numeric"
          />
        </View>
      </View>

      <TextField
        label="Note — optional"
        value={note}
        onChangeText={setNote}
        placeholder='e.g. "final price, ready stock"'
        autoCapitalize="sentences"
      />

      <Button
        label={submitting ? 'Sending…' : 'Send counter'}
        variant="primary"
        onPress={submit}
        disabled={!valid || submitting}
      />
      <View style={styles.gap} />
      <Button label="Cancel" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 11 },
  col: { flex: 1 },
  gap: { height: 10 },
});
