import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassPanel } from './GlassPanel';
import { colors, glass, radii } from './theme';

/**
 * Quantity stepper (.qty) — −/+ buttons around a numeric field. Used on the
 * item form and the Reserve sheet, where `max` drives the over-reserve error.
 */
export function QtyStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
}: {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
}): React.JSX.Element {
  const over = max !== undefined && value > max;

  const bump = (delta: number): void => {
    void Haptics.selectionAsync();
    onChange(Math.max(min, value + delta));
  };

  return (
    <GlassPanel effect="clear" radius={radii.input} fill={glass.fillInput} style={styles.wrap}>
      <Pressable onPress={() => bump(-step)} style={styles.btn}>
        <Text style={styles.sign}>−</Text>
      </Pressable>
      <TextInput
        value={value.toLocaleString()}
        onChangeText={(t) => onChange(Number(t.replace(/[^0-9]/g, '')) || 0)}
        inputMode="numeric"
        style={[styles.input, over && styles.inputOver]}
      />
      <Pressable onPress={() => bump(step)} style={styles.btn}>
        <Text style={styles.sign}>+</Text>
      </Pressable>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginTop: 7, overflow: 'hidden' },
  btn: { width: 44, height: 49, alignItems: 'center', justifyContent: 'center' },
  sign: { fontSize: 20, fontWeight: '800', color: colors.blue },
  input: {
    flex: 1,
    minWidth: 0,
    height: 49,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  inputOver: { color: colors.red },
});
