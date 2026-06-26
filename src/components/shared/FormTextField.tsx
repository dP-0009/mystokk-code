import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
  type RegisterOptions,
} from 'react-hook-form';
import { colors } from '../../theme/tokens';

interface FormTextFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  rules?: RegisterOptions<T, Path<T>>;
  secureToggle?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  testID?: string;
}

/** Renders a field label, coloring a trailing required-asterisk red (spec convention). */
function FieldLabel({ label }: { label: string }): React.JSX.Element {
  const idx = label.lastIndexOf('*');
  if (idx === -1) return <Text style={styles.label}>{label}</Text>;
  return (
    <Text style={styles.label}>
      {label.slice(0, idx)}
      <Text style={styles.required}>{label.slice(idx)}</Text>
    </Text>
  );
}

/** react-hook-form Controller-wrapped text field with inline error + eye toggle. */
export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  rules,
  secureToggle = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  multiline = false,
  testID,
}: FormTextFieldProps<T>): React.JSX.Element {
  const [hidden, setHidden] = useState(secureToggle);

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View style={styles.group}>
          <FieldLabel label={label} />
          <View style={[styles.inputWrap, error ? styles.inputError : null]}>
            <TextInput
              testID={testID ?? `field-${String(name)}`}
              style={[styles.input, multiline ? styles.inputMultiline : null]}
              value={(value as string | undefined) ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={placeholder}
              placeholderTextColor={colors.slate400}
              secureTextEntry={secureToggle ? hidden : false}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              autoCorrect={false}
              multiline={multiline}
              textAlignVertical={multiline ? 'top' : 'center'}
            />
            {secureToggle ? (
              <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
                <Text style={styles.toggle}>{hidden ? '👁' : '🙈'}</Text>
              </Pressable>
            ) : null}
          </View>
          {error ? <Text style={styles.error}>{error.message}</Text> : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginBottom: 6 },
  required: { color: colors.red },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  inputError: { borderColor: colors.red },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: colors.slate900 },
  inputMultiline: { minHeight: 96, paddingTop: 12 },
  toggle: { fontSize: 16, paddingLeft: 8 },
  error: { fontSize: 11, fontWeight: '600', color: colors.red, marginTop: 4 },
});
