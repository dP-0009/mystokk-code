import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { addManualVendor } from '../services/supabase/network';
import { SETTINGS_INDUSTRIES, SETTINGS_INDUSTRY_CATEGORIES, COUNTRIES } from '../constants/industries';
import { DIAL_OPTIONS, dialFromOption, splitPhone } from '../constants/countries';
import { toast } from '../stores/toast';
import {
  Button,
  CategoryChip,
  CategoryChipGroup,
  NavBar,
  PickerSheet,
  ScreenBackground,
  Select,
  TextArea,
  TextField,
  colors,
  layout,
  spacing,
} from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'AddVendor'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_DIAL = '+971';
const combine = (dial: string, number: string): string => (number ? `${dial}${number}` : '');

type PickerId = 'mobileDial' | 'telDial' | 'industry' | 'country' | null;

/**
 * Add vendor (prototype SCREENS.addVendor). No banner; ONLY Email is mandatory.
 * Mobile/WhatsApp and a separate Telephone field each get a country-code picker.
 * Industry reveals a Categories chip multi-select. Wired to the existing
 * addManualVendor mutation.
 */
export function AddVendorScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [companyName, setCompanyName] = React.useState('');
  const [contactPerson, setContactPerson] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [mobile, setMobile] = React.useState(''); // combined
  const [tel, setTel] = React.useState(''); // combined
  const [industry, setIndustry] = React.useState('');
  const [categories, setCategories] = React.useState<string[]>([]);
  const [city, setCity] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [picker, setPicker] = React.useState<PickerId>(null);
  const [touched, setTouched] = React.useState(false);

  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = email.trim().length > 0 && emailValid;

  const mobileParts = splitPhone(mobile);
  const telParts = splitPhone(tel);

  const onIndustry = (v: string): void => {
    setIndustry(v);
    const allowed = SETTINGS_INDUSTRY_CATEGORIES[v] ?? [];
    setCategories((cur) => cur.filter((c) => allowed.includes(c)));
  };

  const categoryOptions = industry ? SETTINGS_INDUSTRY_CATEGORIES[industry] ?? [] : [];

  const mutation = useMutation({
    mutationFn: () =>
      addManualVendor({
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim() || undefined,
        email: email.trim(),
        mobileNumber: mobile.trim() || undefined,
        industry: industry || undefined,
        country: country || undefined,
        city: city.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Vendor added to network');
      navigation.goBack();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not add vendor.'),
  });

  const submit = (): void => {
    setTouched(true);
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <ScreenBackground>
      <NavBar title="Add vendor" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextField label="Company name" value={companyName} onChangeText={setCompanyName} placeholder="Company Ltd." autoCapitalize="words" />
          <TextField label="Contact person" value={contactPerson} onChangeText={setContactPerson} placeholder="John Smith" autoCapitalize="words" />
          <TextField
            label="Email"
            required
            value={email}
            onChangeText={setEmail}
            placeholder="contact@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={touched && !canSubmit ? (email.trim() ? 'Enter a valid email' : 'Email is required') : undefined}
          />

          {/* Mobile / WhatsApp — code + number. */}
          <View style={styles.phoneRow}>
            <Select label="Code" value={mobileParts.dial || DEFAULT_DIAL} onPress={() => setPicker('mobileDial')} style={styles.dial} />
            <TextField
              label="Mobile / WhatsApp"
              value={mobileParts.number}
              onChangeText={(n) => setMobile(combine(mobileParts.dial || DEFAULT_DIAL, n.replace(/[^0-9]/g, '')))}
              placeholder="9876543210"
              keyboardType="phone-pad"
              style={styles.phoneNum}
            />
          </View>

          {/* Separate Telephone — its own code + number. */}
          <View style={styles.phoneRow}>
            <Select label="Code" value={telParts.dial || DEFAULT_DIAL} onPress={() => setPicker('telDial')} style={styles.dial} />
            <TextField
              label="Telephone"
              value={telParts.number}
              onChangeText={(n) => setTel(combine(telParts.dial || DEFAULT_DIAL, n.replace(/[^0-9]/g, '')))}
              placeholder="Telephone (optional)"
              keyboardType="phone-pad"
              style={styles.phoneNum}
            />
          </View>

          <Select label="Industry" placeholder="Select industry" value={industry || undefined} onPress={() => setPicker('industry')} />
          {industry ? (
            <View style={styles.catsWrap}>
              <Text style={styles.catsLabel}>Categories</Text>
              <CategoryChipGroup>
                {categoryOptions.map((c) => (
                  <CategoryChip
                    key={c}
                    label={c}
                    selected={categories.includes(c)}
                    onPress={() => setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))}
                  />
                ))}
              </CategoryChipGroup>
            </View>
          ) : null}

          <View style={styles.row}>
            <View style={styles.col}>
              <TextField label="City" value={city} onChangeText={setCity} placeholder="Dubai" autoCapitalize="words" />
            </View>
            <View style={styles.col}>
              <Select label="Country" placeholder="UAE" value={country || undefined} onPress={() => setPicker('country')} />
            </View>
          </View>

          <TextArea label="Notes" value={notes} onChangeText={setNotes} placeholder="Additional notes about this vendor…" autoCapitalize="sentences" />

          <Button
            label={mutation.isPending ? 'Adding…' : 'Add vendor'}
            variant="primary"
            onPress={submit}
            disabled={mutation.isPending}
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        open={picker === 'mobileDial'}
        onClose={() => setPicker(null)}
        title="Country code"
        options={DIAL_OPTIONS}
        searchable
        onSelect={(opt) => setMobile(combine(dialFromOption(opt), mobileParts.number))}
      />
      <PickerSheet
        open={picker === 'telDial'}
        onClose={() => setPicker(null)}
        title="Country code"
        options={DIAL_OPTIONS}
        searchable
        onSelect={(opt) => setTel(combine(dialFromOption(opt), telParts.number))}
      />
      <PickerSheet open={picker === 'industry'} onClose={() => setPicker(null)} title="Industry" options={SETTINGS_INDUSTRIES} value={industry} onSelect={onIndustry} />
      <PickerSheet
        open={picker === 'country'}
        onClose={() => setPicker(null)}
        title="Country"
        options={COUNTRIES}
        value={country}
        searchable
        onSelect={setCountry}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter },
  phoneRow: { flexDirection: 'row', gap: 11 },
  dial: { width: 104 },
  phoneNum: { flex: 1 },
  row: { flexDirection: 'row', gap: 11 },
  col: { flex: 1 },
  catsWrap: { marginBottom: 14 },
  catsLabel: { fontSize: 13, fontWeight: '800', color: colors.navy, marginBottom: 8 },
  submit: { marginTop: 6 },
});
