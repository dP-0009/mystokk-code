import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useController,
  type Control,
  type FieldValues,
  type Path,
  type RegisterOptions,
} from 'react-hook-form';

import { colors } from '../../theme/tokens';
import { DIAL_OPTIONS, dialFromOption, dialForCountry, splitPhone } from '../../constants/countries';

interface PhoneFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  /** When this country name changes, the dial code auto-fills to match it. */
  countryName?: string | null;
  rules?: RegisterOptions<T, Path<T>>;
  placeholder?: string;
  testID?: string;
}

/**
 * Phone input with a SEPARATE country-code picker (all world dial codes) and a
 * number box. The stored value is the combined E.164 string ("+971526630872").
 *
 *  • Leading zeros typed in the number box are stripped automatically (a local
 *    trunk "0" is dropped in international format).
 *  • Picking a Country elsewhere in the form auto-fills the dial code here.
 */
export function PhoneField<T extends FieldValues>({
  control,
  name,
  label,
  countryName,
  rules,
  placeholder = 'Phone number',
  testID,
}: PhoneFieldProps<T>): React.JSX.Element {
  const { field, fieldState } = useController({ control, name, rules });
  const error = fieldState.error;

  // Local state is the UI source of truth so the dial survives an empty number.
  const initial = splitPhone(field.value as string | undefined);
  const [dial, setDial] = useState(initial.dial);
  const [number, setNumber] = useState(initial.number);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Combined value stored in the form (empty when there's no number).
  const push = (d: string, n: string): void => field.onChange(n ? `${d}${n}` : '');

  const onNumber = (raw: string): void => {
    const n = raw.replace(/[^\d]/g, '').replace(/^0+/, ''); // digits only, no leading zeros
    setNumber(n);
    push(dial, n);
  };
  const onPickDial = (option: string): void => {
    const d = dialFromOption(option);
    setDial(d);
    push(d, number);
    setQuery('');
    setOpen(false);
  };

  // Auto-fill the dial when the selected country changes (skip first render so a
  // saved number's own code isn't overwritten on load).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const d = dialForCountry(countryName);
    if (d) {
      setDial(d);
      push(d, number);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DIAL_OPTIONS;
    return DIAL_OPTIONS.filter((o) => o.toLowerCase().includes(q));
  }, [query]);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        {label}
        {rules?.required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <View style={styles.row}>
        <Pressable
          style={[styles.codeBtn, error ? styles.errBorder : null]}
          onPress={() => setOpen(true)}
          testID={testID ? `${testID}-code` : `phone-code-${String(name)}`}
        >
          <Text style={dial ? styles.codeText : styles.codePlaceholder}>{dial || 'Code'}</Text>
          <Text style={styles.chevron}>▾</Text>
        </Pressable>

        <View style={[styles.numberWrap, error ? styles.errBorder : null]}>
          <TextInput
            style={styles.numberInput}
            value={number}
            onChangeText={onNumber}
            placeholder={placeholder}
            placeholderTextColor={colors.slate400}
            keyboardType="phone-pad"
            autoCorrect={false}
            testID={testID ?? `phone-${String(name)}`}
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error.message}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Country code</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.search}
              placeholder="Search country or code…"
              placeholderTextColor={colors.slate400}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSel = dialFromOption(item) === dial;
                return (
                  <Pressable style={styles.option} onPress={() => onPickDial(item)}>
                    <Text style={[styles.optionText, isSel ? styles.optionSelected : null]}>{item}</Text>
                    {isSel ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              }}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginBottom: 6 },
  required: { color: colors.red },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 84,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  codeText: { fontSize: 14, color: colors.slate900, fontWeight: '600' },
  codePlaceholder: { fontSize: 14, color: colors.slate400 },
  chevron: { fontSize: 12, color: colors.slate500, marginLeft: 'auto' },

  numberWrap: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  numberInput: { paddingVertical: 12, fontSize: 14, color: colors.slate900 },
  errBorder: { borderColor: colors.red },
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
