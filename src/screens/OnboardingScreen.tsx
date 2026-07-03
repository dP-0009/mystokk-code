import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { FormTextField } from '../components/shared/FormTextField';
import { PhoneField } from '../components/shared/PhoneField';
import { SelectField } from '../components/shared/SelectField';
import { AppButton } from '../components/shared/AppButton';
import { onboardVendor } from '../services/supabase/vendor';
import { uploadCompanyLogo, type UploadFile } from '../services/supabase/storage';
import { requestPushPermissionAndRegister } from '../services/push';
import { useAuthStore } from '../stores/authStore';
import { CATEGORIES, COUNTRIES, INDUSTRIES } from '../constants/industries';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

interface OnboardingForm {
  companyName: string;
  contactPerson: string;
  industry: string;
  categories: string[];
  country: string;
  city: string;
  address: string;
  mobileNumber: string;
  telCountryCode: string;
  telNumber: string;
  description: string;
}

const STEP1_FIELDS = ['companyName', 'contactPerson', 'industry'] as const;
const STEP2_FIELDS = ['country', 'city', 'mobileNumber'] as const;

export function OnboardingScreen(_props: Props): React.JSX.Element {
  const userId = useAuthStore((s) => s.session?.user.id);
  const refreshVendor = useAuthStore((s) => s.refreshVendor);

  const { control, handleSubmit, trigger, watch } = useForm<OnboardingForm>({
    defaultValues: {
      companyName: '',
      contactPerson: '',
      industry: '',
      categories: [],
      country: '',
      city: '',
      address: '',
      mobileNumber: '',
      telCountryCode: '',
      telNumber: '',
      description: '',
    },
  });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [logo, setLogo] = useState<UploadFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Selected country drives the phone dial-code auto-fill.
  const country = watch('country');

  const onNext = async (): Promise<void> => {
    const fields = step === 1 ? STEP1_FIELDS : STEP2_FIELDS;
    const valid = await trigger([...fields]);
    if (valid) setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  };

  const onBack = (): void => {
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  };

  const pickLogo = async (): Promise<void> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setLogo({
      uri: asset.uri,
      name: asset.fileName ?? `logo-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  };

  const onFinish = handleSubmit(async (values) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (logo && userId) {
        await uploadCompanyLogo(userId, logo);
      }
      await onboardVendor({
        companyName: values.companyName,
        contactPerson: values.contactPerson,
        industry: values.industry,
        categories: values.categories,
        country: values.country,
        city: values.city,
        address: values.address,
        mobileNumber: values.mobileNumber,
        telCountryCode: values.telCountryCode,
        telNumber: values.telNumber,
        description: values.description,
      });
      // First meaningful action complete → now ask for push permission (never on launch).
      void requestPushPermissionAndRegister();
      // Flip onboarded=true → reactive navigator advances to Main (Dashboard).
      await refreshVendor();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not finish setup.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <View style={styles.fill}>
      <ScreenHeader title="Set Up Your Company" />

      <View style={styles.progress}>
        {[1, 2, 3].map((seg) => (
          <View key={seg} style={[styles.segment, seg <= step ? styles.segmentDone : null]} />
        ))}
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {step === 1 ? (
            <>
              <Text style={styles.stepTitle}>Tell us about your company</Text>
              <Text style={styles.stepSub}>This appears on every share you send to your network</Text>

              <FormTextField
                control={control}
                name="companyName"
                label="Company Name *"
                placeholder="e.g. Nova Electronics Trading LLC"
                autoCapitalize="words"
                rules={{ required: 'Company name is required' }}
              />
              <FormTextField
                control={control}
                name="contactPerson"
                label="Contact Person *"
                placeholder="Your full name"
                autoCapitalize="words"
                rules={{ required: 'Contact person is required' }}
              />
              <SelectField
                control={control}
                name="industry"
                label="Industry"
                placeholder="Select industry"
                options={INDUSTRIES}
                required
                rules={{ required: 'Industry is required' }}
              />

              <Text style={styles.label}>Categories</Text>
              <Text style={styles.hint}>Pick the categories you trade — these power share filters later.</Text>
              <Controller
                control={control}
                name="categories"
                render={({ field: { value, onChange } }) => (
                  <View style={styles.pills}>
                    {CATEGORIES.map((cat) => {
                      const active = value.includes(cat);
                      return (
                        <Pressable
                          key={cat}
                          onPress={() =>
                            onChange(active ? value.filter((c) => c !== cat) : [...value, cat])
                          }
                          style={[styles.pill, active ? styles.pillActive : null]}
                        >
                          <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{cat}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.stepTitle}>Where are you based?</Text>
              <Text style={styles.stepSub}>Helps vendors filter their network by location</Text>

              <SelectField
                control={control}
                name="country"
                label="Country"
                placeholder="Select country"
                options={COUNTRIES}
                required
                rules={{ required: 'Country is required' }}
              />
              <FormTextField
                control={control}
                name="city"
                label="City *"
                placeholder="e.g. Dubai"
                autoCapitalize="words"
                rules={{ required: 'City is required' }}
              />
              <FormTextField
                control={control}
                name="address"
                label="Address"
                placeholder="Street address, building, area"
                autoCapitalize="words"
              />
              <PhoneField
                control={control}
                name="mobileNumber"
                label="Mobile Number *"
                countryName={country}
                placeholder="50 000 0000"
                rules={{ required: 'Mobile number is required' }}
              />
              <PhoneField
                control={control}
                name="telNumber"
                label="Telephone (optional)"
                countryName={country}
                placeholder="Telephone (optional)"
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.stepTitle}>Add your company logo</Text>
              <Text style={styles.stepSub}>Shown on share cards and your public profile</Text>

              <Pressable style={styles.logoBox} onPress={pickLogo}>
                {logo ? (
                  <Image source={{ uri: logo.uri }} style={styles.logoPreview} />
                ) : (
                  <Text style={styles.logoIcon}>📷</Text>
                )}
              </Pressable>
              <Text style={styles.logoHint}>{logo ? 'Tap to change' : 'Tap to choose from your gallery'}</Text>

              <FormTextField
                control={control}
                name="description"
                label="Company Description"
                placeholder="A short description of what you trade…"
                autoCapitalize="sentences"
                multiline
              />

              {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {step > 1 ? (
          <View style={styles.backBtn}>
            <AppButton title="Back" variant="outline" onPress={onBack} />
          </View>
        ) : null}
        <View style={styles.nextBtn}>
          {step < 3 ? (
            <AppButton title="Continue" onPress={onNext} />
          ) : (
            <AppButton title="Finish Setup" onPress={onFinish} loading={submitting} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingTop: 16 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.slate200 },
  segmentDone: { backgroundColor: colors.emerald },
  body: { padding: 24 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  stepSub: { fontSize: 13, color: colors.slate500, marginBottom: 22 },
  label: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginBottom: 4 },
  hint: { fontSize: 11, color: colors.slate400, marginBottom: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    backgroundColor: '#FFFFFF',
  },
  pillActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.slate700 },
  pillTextActive: { color: '#FFFFFF' },
  telRow: { flexDirection: 'row', gap: 12 },
  telCode: { width: 96 },
  telNumber: { flex: 1 },
  logoBox: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.slate200,
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 8,
  },
  logoPreview: { width: '100%', height: '100%' },
  logoIcon: { fontSize: 38 },
  logoHint: { textAlign: 'center', fontSize: 12, color: colors.slate400, marginTop: 8, marginBottom: 22 },
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    backgroundColor: '#FFFFFF',
  },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
});
