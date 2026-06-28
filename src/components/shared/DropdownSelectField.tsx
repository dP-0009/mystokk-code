import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
  type RegisterOptions,
} from 'react-hook-form';

import { colors, radius } from '../../theme/tokens';
import { webOnly } from '../layout/web';

interface DropdownSelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder: string;
  options: readonly string[];
  required?: boolean;
  rules?: RegisterOptions<T, Path<T>>;
  testID?: string;
}

/**
 * react-hook-form select that opens an inline custom dropdown panel (not a
 * native select, not a bottom sheet). The trigger looks like an input with a
 * chevron; the panel floats directly below it with hover + selected states.
 */
export function DropdownSelectField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  options,
  required = false,
  rules,
  testID,
}: DropdownSelectFieldProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { value, onChange }, fieldState: { error } }) => {
        const selected = (value as string | undefined) ?? '';
        return (
          <View style={[styles.group, open ? styles.groupOpen : null]}>
            <Text style={styles.label}>
              {label}
              {required ? <Text style={styles.required}> *</Text> : null}
            </Text>

            <View style={styles.anchor}>
              <Pressable
                style={[styles.trigger, error ? styles.triggerError : null, open ? styles.triggerOpen : null]}
                onPress={() => setOpen((o) => !o)}
                testID={testID ?? `dropdown-${String(name)}`}
              >
                <Text style={selected ? styles.valueText : styles.placeholder} numberOfLines={1}>
                  {selected || placeholder}
                </Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
              </Pressable>

              {open ? (
                <View style={styles.panel}>
                  <ScrollView
                    style={styles.panelScroll}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {options.map((opt) => (
                      <Option
                        key={opt}
                        label={opt}
                        selected={opt === selected}
                        onPress={() => {
                          onChange(opt);
                          setOpen(false);
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            {error ? <Text style={styles.error}>{error.message}</Text> : null}
          </View>
        );
      }}
    />
  );
}

/** A single dropdown option row — hover (#F1F5F9) + selected (#EFF6FF/#2563EB) states. */
function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={[styles.option, hover ? styles.optionHover : null, selected ? styles.optionSelected : null]}
    >
      <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={16} color={colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 16, zIndex: 1 },
  // Lift the open field above the ones below so its panel overlays them.
  groupOpen: { zIndex: 9999 },
  label: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginBottom: 6 },
  required: { color: colors.red },

  // Relative anchor so the panel floats directly under the trigger.
  anchor: { position: 'relative' },
  // Trigger — input-like, chevron on the right.
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border, // #E2E8F0
    borderRadius: radius.md, // 10
    backgroundColor: colors.bgWhite,
    paddingVertical: 10,
    paddingHorizontal: 14,
    ...webOnly({ cursor: 'pointer' }),
  },
  triggerOpen: { borderColor: colors.accent },
  triggerError: { borderColor: colors.red },
  valueText: { fontSize: 14, color: colors.textPrimary, flexShrink: 1 },
  placeholder: { fontSize: 14, color: colors.textMuted, flexShrink: 1 },
  error: { fontSize: 11, fontWeight: '600', color: colors.red, marginTop: 4 },

  // Floating dropdown panel.
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    maxHeight: 280,
    backgroundColor: colors.bgWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border, // #E2E8F0
    overflow: 'hidden',
    zIndex: 9999,
    // 0 8px 24px rgba(0,0,0,0.12)
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  panelScroll: { maxHeight: 280 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...webOnly({ cursor: 'pointer' }),
  },
  optionHover: { backgroundColor: colors.bgChip }, // #F1F5F9
  optionSelected: { backgroundColor: colors.accentLight }, // #EFF6FF
  optionText: { fontSize: 13, color: colors.textPrimary },
  optionTextSelected: { color: colors.accent, fontWeight: '600' }, // #2563EB
});
