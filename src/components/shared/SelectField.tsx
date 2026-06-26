import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
  type RegisterOptions,
} from 'react-hook-form';
import { colors } from '../../theme/tokens';

interface SelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder: string;
  options: readonly string[];
  required?: boolean;
  rules?: RegisterOptions<T, Path<T>>;
  searchable?: boolean;
  testID?: string;
}

/** react-hook-form select that opens a searchable modal list of options. */
export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  options,
  required = false,
  rules,
  searchable = true,
  testID,
}: SelectFieldProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { value, onChange }, fieldState: { error } }) => {
        const selected = value as string | undefined;
        return (
          <View style={styles.group}>
            <Text style={styles.label}>
              {label}
              {required ? <Text style={styles.required}> *</Text> : null}
            </Text>
            <Pressable
              style={[styles.select, error ? styles.selectError : null]}
              onPress={() => setOpen(true)}
              testID={testID ?? `select-${String(name)}`}
            >
              <Text style={selected ? styles.valueText : styles.placeholder}>
                {selected || placeholder}
              </Text>
              <Text style={styles.chevron}>▾</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error.message}</Text> : null}

            <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
              <View style={styles.backdrop}>
                <SafeAreaView edges={['bottom']} style={styles.sheet}>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>{label}</Text>
                    <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                      <Text style={styles.close}>✕</Text>
                    </Pressable>
                  </View>
                  {searchable ? (
                    <TextInput
                      style={styles.search}
                      placeholder="Search…"
                      placeholderTextColor={colors.slate400}
                      value={query}
                      onChangeText={setQuery}
                      autoCorrect={false}
                    />
                  ) : null}
                  <FlatList
                    data={filtered}
                    keyExtractor={(item) => item}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <Pressable
                        style={styles.option}
                        onPress={() => {
                          onChange(item);
                          setQuery('');
                          setOpen(false);
                        }}
                      >
                        <Text style={[styles.optionText, item === selected ? styles.optionSelected : null]}>
                          {item}
                        </Text>
                        {item === selected ? <Text style={styles.check}>✓</Text> : null}
                      </Pressable>
                    )}
                  />
                </SafeAreaView>
              </View>
            </Modal>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginBottom: 6 },
  required: { color: colors.red },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  selectError: { borderColor: colors.red },
  valueText: { fontSize: 14, color: colors.slate900 },
  placeholder: { fontSize: 14, color: colors.slate400 },
  chevron: { fontSize: 12, color: colors.slate500 },
  error: { fontSize: 11, fontWeight: '600', color: colors.red, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '75%' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: colors.slate900 },
  close: { fontSize: 18, color: colors.slate500 },
  search: {
    margin: 16,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.slate900,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  optionText: { fontSize: 14, color: colors.slate700 },
  optionSelected: { color: colors.emerald, fontWeight: '700' },
  check: { fontSize: 14, color: colors.emerald, fontWeight: '700' },
});
