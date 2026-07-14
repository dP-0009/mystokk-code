import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { GlassPanel } from './GlassPanel';
import { Icon } from './Icon';
import { colors, glass, layout, radii, typography } from './theme';

/**
 * Field wrapper: label (with required asterisk), control, and error text.
 * Inputs use the BRIGHT glass fill (0.42) — a card-weight fill makes text
 * fields look disabled.
 */
function Field({
  label,
  required,
  error,
  children,
  style,
}: {
  label?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View style={[styles.field, style]}>
      {label ? (
        <Text style={typography.label}>
          {label}
          {required ? <Text style={styles.req}> *</Text> : null}
        </Text>
      ) : null}
      {children}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  required?: boolean;
  error?: string;
  style?: StyleProp<ViewStyle>;
}

export function TextField({ label, required, error, style, ...input }: TextFieldProps): React.JSX.Element {
  return (
    <Field label={label} required={required} error={error} style={style}>
      <GlassPanel effect="clear" radius={radii.input} fill={glass.fillInput} style={styles.control}>
        <TextInput
          placeholderTextColor={colors.placeholder}
          {...input}
          style={[styles.input, { height: layout.inputHeight }]}
        />
      </GlassPanel>
    </Field>
  );
}

export function TextArea({ label, required, error, style, ...input }: TextFieldProps): React.JSX.Element {
  return (
    <Field label={label} required={required} error={error} style={style}>
      <GlassPanel effect="clear" radius={radii.input} fill={glass.fillInput} style={styles.control}>
        <TextInput
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.placeholder}
          {...input}
          style={[styles.input, styles.textarea]}
        />
      </GlassPanel>
    </Field>
  );
}

/**
 * Select — a pressable field with a chevron. Opening the option list is the
 * caller's job (use <Sheet/>), which keeps the picker native and avoids
 * shipping a second dropdown implementation.
 */
export function Select({
  label,
  required,
  error,
  value,
  placeholder = 'Select…',
  onPress,
  style,
}: {
  label?: string;
  required?: boolean;
  error?: string;
  value?: string;
  placeholder?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <Field label={label} required={required} error={error} style={style}>
      <Pressable onPress={onPress}>
        <GlassPanel effect="clear" radius={radii.input} fill={glass.fillInput} style={styles.control}>
          <View style={[styles.selectRow, { height: layout.inputHeight }]}>
            <Text style={[styles.input, styles.selectText, !value && styles.selectPlaceholder]} numberOfLines={1}>
              {value ?? placeholder}
            </Text>
            <Icon name="down" size={16} color={colors.muted} />
          </View>
        </GlassPanel>
      </Pressable>
    </Field>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  req: { color: colors.red },
  control: { marginTop: 7, overflow: 'hidden' },
  input: {
    paddingHorizontal: 14,
    fontSize: typography.input.fontSize,
    color: colors.text,
  },
  textarea: { height: 92, paddingTop: 13 },
  selectRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 14 },
  selectText: { flex: 1 },
  selectPlaceholder: { color: colors.placeholder },
  err: { color: colors.red, fontSize: 12.5, fontWeight: '700', marginTop: 6 },
});
