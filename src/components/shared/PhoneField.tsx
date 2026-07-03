import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  useController,
  type Control,
  type FieldValues,
  type Path,
  type RegisterOptions,
} from 'react-hook-form';

import { colors } from '../../theme/tokens';
import { DIAL_OPTIONS, dialFromOption, dialForCountry, splitPhone } from '../../constants/countries';
import { webOnly } from '../layout/web';

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
 *  • Tapping the code opens an anchored dropdown with a search bar.
 *  • Leading zeros typed in the number box are stripped automatically.
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
    <View style={[styles.group, open ? styles.groupOpen : null]}>
      <Text style={styles.label}>
        {label}
        {rules?.required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <View style={styles.row}>
        <View style={styles.codeAnchor}>
          <Pressable
            style={[styles.codeBtn, error ? styles.errBorder : null, open ? styles.codeBtnOpen : null]}
            onPress={() => setOpen((o) => !o)}
            testID={testID ? `${testID}-code` : `phone-code-${String(name)}`}
          >
            <Text style={dial ? styles.codeText : styles.codePlaceholder}>{dial || 'Code'}</Text>
            <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
          </Pressable>

          {open ? (
            <>
              {/* Full-screen catcher so an outside click closes the dropdown. */}
              <Pressable style={styles.outside} onPress={() => setOpen(false)} />
              <View style={styles.panel}>
                <TextInput
                  style={styles.search}
                  placeholder="Search country or code…"
                  placeholderTextColor={colors.slate400}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoFocus
                />
                <ScrollView style={styles.panelScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {filtered.length === 0 ? (
                    <Text style={styles.empty}>No match</Text>
                  ) : (
                    filtered.map((item) => {
                      const isSel = dialFromOption(item) === dial;
                      return (
                        <Pressable
                          key={item}
                          style={[styles.option, isSel ? styles.optionSel : null]}
                          onPress={() => onPickDial(item)}
                        >
                          <Text style={[styles.optionText, isSel ? styles.optionTextSel : null]} numberOfLines={1}>
                            {item}
                          </Text>
                          {isSel ? <Text style={styles.check}>✓</Text> : null}
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </>
          ) : null}
        </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 16, zIndex: 1 },
  // Lift the whole field above later siblings when the dropdown is open.
  groupOpen: { zIndex: 9999, ...webOnly({ position: 'relative' }) },
  label: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginBottom: 6 },
  required: { color: colors.red },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },

  // Code button + its anchored dropdown.
  codeAnchor: { position: 'relative', zIndex: 2 },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 92,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 13,
    ...webOnly({ cursor: 'pointer' }),
  },
  codeBtnOpen: { borderColor: colors.emerald },
  codeText: { fontSize: 14, color: colors.slate900, fontWeight: '600' },
  codePlaceholder: { fontSize: 14, color: colors.slate400 },
  chevron: { fontSize: 12, color: colors.slate500, marginLeft: 'auto' },

  // Full-screen transparent outside-click catcher.
  outside: { position: 'absolute', top: -2000, bottom: -2000, left: -2000, right: -2000, zIndex: 9998 },

  // Anchored dropdown panel.
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 6,
    width: 300,
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 9999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  search: {
    margin: 8,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.slate900,
    ...({ outlineStyle: 'none' } as object),
  },
  panelScroll: { maxHeight: 240 },
  empty: { paddingHorizontal: 14, paddingVertical: 16, fontSize: 13, color: colors.slate400 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...webOnly({ cursor: 'pointer' }),
  },
  optionSel: { backgroundColor: '#ECFDF5' },
  optionText: { fontSize: 13, color: colors.slate700, flexShrink: 1 },
  optionTextSel: { color: colors.emerald, fontWeight: '700' },
  check: { fontSize: 13, color: colors.emerald, fontWeight: '700' },

  // Number box.
  numberWrap: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  numberInput: {
    paddingVertical: 12,
    fontSize: 14,
    color: colors.slate900,
    ...({ outlineStyle: 'none' } as object),
  },
  errBorder: { borderColor: colors.red },
  error: { fontSize: 11, fontWeight: '600', color: colors.red, marginTop: 4 },
});
