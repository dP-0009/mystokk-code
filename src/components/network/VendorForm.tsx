import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SETTINGS_INDUSTRIES, SETTINGS_INDUSTRY_CATEGORIES, COUNTRIES } from '../../constants/industries';
import { DIAL_OPTIONS, dialFromOption, splitPhone } from '../../constants/countries';
import {
  Button,
  CategoryChip,
  CategoryChipGroup,
  PickerSheet,
  Select,
  TextField,
  colors,
  layout,
  spacing,
} from '../mobile';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_DIAL = '+971';
const combine = (dial: string, number: string): string => (number ? `${dial}${number}` : '');

type PickerId = 'mobileDial' | 'telDial' | 'industry' | 'country' | null;

/** All fields the vendor form can hold. `mobile`/`tel` are combined dial+number. */
export interface VendorFormValues {
  companyName: string;
  contactPerson: string;
  email: string;
  mobile: string;
  tel: string;
  industry: string;
  categories: string[];
  city: string;
  country: string;
  group: string;
}

const EMPTY: VendorFormValues = {
  companyName: '',
  contactPerson: '',
  email: '',
  mobile: '',
  tel: '',
  industry: '',
  categories: [],
  city: '',
  country: '',
  group: '',
};

interface VendorFormProps {
  mode: 'add' | 'edit';
  initial?: Partial<VendorFormValues>;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  /**
   * Registered-connection edit: the vendor manages their own profile, so every
   * field except Group is read-only (matches the web privacy rule).
   */
  lockedExceptGroup?: boolean;
  /** Optional note shown above the fields (used by the locked connection mode). */
  note?: string;
  onSubmit: (values: VendorFormValues) => void;
}

/**
 * The ONE vendor form — glass UI, shared by Add Vendor and Edit Vendor. NATIVE
 * ONLY. Add mode starts empty; Edit mode prefills from `initial`. Industry
 * reveals its Categories chips; Mobile/WhatsApp and Telephone each get a
 * country-code picker. The parent screen owns the ScreenBackground + NavBar and
 * supplies the submit handler (add or update mutation).
 */
export function VendorForm({
  mode,
  initial,
  submitLabel,
  submitting,
  error,
  lockedExceptGroup = false,
  note,
  onSubmit,
}: VendorFormProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const seed = { ...EMPTY, ...initial };

  const [companyName, setCompanyName] = React.useState(seed.companyName);
  const [contactPerson, setContactPerson] = React.useState(seed.contactPerson);
  const [email, setEmail] = React.useState(seed.email);
  const [mobile, setMobile] = React.useState(seed.mobile);
  const [tel, setTel] = React.useState(seed.tel);
  const [industry, setIndustry] = React.useState(seed.industry);
  const [categories, setCategories] = React.useState<string[]>(seed.categories);
  const [city, setCity] = React.useState(seed.city);
  const [country, setCountry] = React.useState(seed.country);
  const [group, setGroup] = React.useState(seed.group);
  const [picker, setPicker] = React.useState<PickerId>(null);
  const [touched, setTouched] = React.useState(false);

  const locked = lockedExceptGroup;
  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = locked
    ? true
    : mode === 'add'
      ? email.trim().length > 0 && emailValid
      : companyName.trim().length > 0 && (email.trim() === '' || emailValid);

  const mobileParts = splitPhone(mobile);
  const telParts = splitPhone(tel);

  const onIndustry = (v: string): void => {
    setIndustry(v);
    const allowed = SETTINGS_INDUSTRY_CATEGORIES[v] ?? [];
    setCategories((cur) => cur.filter((c) => allowed.includes(c)));
  };
  const categoryOptions = industry ? SETTINGS_INDUSTRY_CATEGORIES[industry] ?? [] : [];

  const submit = (): void => {
    setTouched(true);
    if (!canSubmit) return;
    onSubmit({ companyName, contactPerson, email, mobile, tel, industry, categories, city, country, group });
  };

  const emailError = touched && !locked
    ? email.trim() === '' && mode === 'add'
      ? 'Email is required'
      : email.trim() !== '' && !emailValid
        ? 'Enter a valid email'
        : undefined
    : undefined;
  const companyError =
    touched && !locked && mode === 'edit' && companyName.trim() === '' ? 'Company name is required' : undefined;

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {note ? <Text style={styles.note}>{note}</Text> : null}

        <TextField
          label="Company name"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="Company Ltd."
          autoCapitalize="words"
          editable={!locked}
          error={companyError}
        />
        <TextField
          label="Contact person"
          value={contactPerson}
          onChangeText={setContactPerson}
          placeholder="John Smith"
          autoCapitalize="words"
          editable={!locked}
        />
        <TextField
          label="Email"
          required={!locked && mode === 'add'}
          value={email}
          onChangeText={setEmail}
          placeholder="contact@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!locked}
          error={emailError}
        />

        {/* Mobile / WhatsApp — code + number. */}
        <View style={styles.phoneRow}>
          <Select
            label="Code"
            value={mobileParts.dial || DEFAULT_DIAL}
            onPress={locked ? undefined : () => setPicker('mobileDial')}
            style={styles.dial}
          />
          <TextField
            label="Mobile / WhatsApp"
            value={mobileParts.number}
            onChangeText={(n) => setMobile(combine(mobileParts.dial || DEFAULT_DIAL, n.replace(/[^0-9]/g, '')))}
            placeholder="9876543210"
            keyboardType="phone-pad"
            editable={!locked}
            style={styles.phoneNum}
          />
        </View>

        {/* Separate Telephone — its own code + number. */}
        <View style={styles.phoneRow}>
          <Select
            label="Code"
            value={telParts.dial || DEFAULT_DIAL}
            onPress={locked ? undefined : () => setPicker('telDial')}
            style={styles.dial}
          />
          <TextField
            label="Telephone"
            value={telParts.number}
            onChangeText={(n) => setTel(combine(telParts.dial || DEFAULT_DIAL, n.replace(/[^0-9]/g, '')))}
            placeholder="Telephone (optional)"
            keyboardType="phone-pad"
            editable={!locked}
            style={styles.phoneNum}
          />
        </View>

        <Select
          label="Industry"
          placeholder="Select industry"
          value={industry || undefined}
          onPress={locked ? undefined : () => setPicker('industry')}
        />
        {industry ? (
          <View style={styles.catsWrap}>
            <Text style={styles.catsLabel}>Categories</Text>
            <CategoryChipGroup>
              {categoryOptions.map((c) => (
                <CategoryChip
                  key={c}
                  label={c}
                  selected={categories.includes(c)}
                  onPress={
                    locked
                      ? undefined
                      : () => setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))
                  }
                />
              ))}
            </CategoryChipGroup>
          </View>
        ) : null}

        <View style={styles.row}>
          <View style={styles.col}>
            <TextField label="City" value={city} onChangeText={setCity} placeholder="Dubai" autoCapitalize="words" editable={!locked} />
          </View>
          <View style={styles.col}>
            <Select
              label="Country"
              placeholder="UAE"
              value={country || undefined}
              onPress={locked ? undefined : () => setPicker('country')}
            />
          </View>
        </View>

        <TextField
          label="Group"
          value={group}
          onChangeText={setGroup}
          placeholder="e.g. Suppliers UAE"
          autoCapitalize="words"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={submitting ? 'Saving…' : submitLabel}
          variant="primary"
          onPress={submit}
          disabled={submitting}
          style={styles.submit}
        />
      </ScrollView>

      <PickerSheet
        open={picker === 'mobileDial'}
        onClose={() => setPicker(null)}
        title="Country code"
        options={DIAL_OPTIONS}
        onSelect={(opt) => setMobile(combine(dialFromOption(opt), mobileParts.number))}
      />
      <PickerSheet
        open={picker === 'telDial'}
        onClose={() => setPicker(null)}
        title="Country code"
        options={DIAL_OPTIONS}
        onSelect={(opt) => setTel(combine(dialFromOption(opt), telParts.number))}
      />
      <PickerSheet open={picker === 'industry'} onClose={() => setPicker(null)} title="Industry" options={SETTINGS_INDUSTRIES} value={industry} onSelect={onIndustry} />
      <PickerSheet
        open={picker === 'country'}
        onClose={() => setPicker(null)}
        title="Country"
        options={COUNTRIES}
        value={country}
        onSelect={setCountry}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  phoneRow: { flexDirection: 'row', gap: 11 },
  dial: { width: 104 },
  phoneNum: { flex: 1 },
  row: { flexDirection: 'row', gap: 11 },
  col: { flex: 1 },
  catsWrap: { marginBottom: 14 },
  catsLabel: { fontSize: 13, fontWeight: '800', color: colors.navy, marginBottom: 8 },
  error: { color: colors.red, fontSize: 13, fontWeight: '700', marginTop: 4, marginBottom: 4, textAlign: 'center' },
  submit: { marginTop: 6 },
});
