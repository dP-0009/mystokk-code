import React, { useEffect, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { BrandMark } from '../components/shared/BrandMark';
import { Reveal } from '../components/shared/Reveal';
import { FormTextField } from '../components/shared/FormTextField';
import { PhoneField } from '../components/shared/PhoneField';
import { DropdownSelectField } from '../components/shared/DropdownSelectField';
import { AppButton } from '../components/shared/AppButton';
import { webOnly } from '../components/layout/web';
import { onboardVendor } from '../services/supabase/vendor';
import { uploadCompanyLogo, type UploadFile } from '../services/supabase/storage';
import { requestPushPermissionAndRegister } from '../services/push';
import { useAuthStore } from '../stores/authStore';
import { COUNTRIES, SETTINGS_INDUSTRIES, SETTINGS_INDUSTRY_CATEGORIES } from '../constants/industries';
import { colors, radius, shadows } from '../theme/tokens';

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
const TOTAL_STEPS = 3;

const STEP_COPY: Record<number, { title: string; sub: string }> = {
  1: { title: 'Tell us about your company', sub: 'This appears on every share you send to your network' },
  2: { title: 'Where are you based?', sub: 'Helps vendors filter their network by location' },
  3: { title: 'Add your company logo', sub: 'Shown on share cards and your public profile' },
};

export function OnboardingScreen(_props: Props): React.JSX.Element {
  const userId = useAuthStore((s) => s.session?.user.id);
  const refreshVendor = useAuthStore((s) => s.refreshVendor);

  const { control, handleSubmit, trigger, watch, setValue, getValues } = useForm<OnboardingForm>({
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
  // Categories are scoped to the chosen industry (same mapping as the profile).
  const industry = watch('industry');
  const categoryOptions = SETTINGS_INDUSTRY_CATEGORIES[industry] ?? [];

  // Changing industry drops any selected category that no longer belongs to it.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const allowed = SETTINGS_INDUSTRY_CATEGORIES[industry] ?? [];
    setValue(
      'categories',
      (getValues('categories') ?? []).filter((c) => allowed.includes(c)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry]);

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
      // Flip onboarded=true → reactive navigator advances to Main (or claims a
      // pending share link and lands on that received item).
      await refreshVendor();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not finish setup.');
    } finally {
      setSubmitting(false);
    }
  });

  const copy = STEP_COPY[step];

  return (
    <View style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        {/* Top bar — brand lockup, matching the Login / Signup chrome. */}
        <View style={styles.topbar}>
          <View style={styles.topbarSide} />
          <BrandMark size={30} labelSize={16} />
          <Text style={styles.stepCount}>
            Step {step} of {TOTAL_STEPS}
          </Text>
        </View>

        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Reveal style={styles.cardWrap} offsetY={28}>
              <View style={styles.card}>
                <View style={styles.progress}>
                  {[1, 2, 3].map((seg) => (
                    <View key={seg} style={[styles.segment, seg <= step ? styles.segmentDone : null]} />
                  ))}
                </View>

                <Text style={styles.stepTitle}>{copy.title}</Text>
                <Text style={styles.stepSub}>{copy.sub}</Text>

                {step === 1 ? (
                  <>
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
                    <DropdownSelectField
                      control={control}
                      name="industry"
                      label="Industry"
                      placeholder="Select industry"
                      options={SETTINGS_INDUSTRIES}
                      required
                      rules={{ required: 'Industry is required' }}
                    />

                    <Text style={styles.label}>Categories</Text>
                    <Text style={styles.hint}>
                      {industry
                        ? 'Pick the categories you trade — these power share filters later.'
                        : 'Select an industry first to see its categories.'}
                    </Text>
                    <Controller
                      control={control}
                      name="categories"
                      render={({ field: { value, onChange } }) => (
                        <View style={styles.pills}>
                          {categoryOptions.map((cat) => {
                            const active = value.includes(cat);
                            return (
                              <Pressable
                                key={cat}
                                onPress={() =>
                                  onChange(active ? value.filter((c) => c !== cat) : [...value, cat])
                                }
                                style={[styles.pill, active ? styles.pillActive : null, webOnly({ cursor: 'pointer' })]}
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
                    <DropdownSelectField
                      control={control}
                      name="country"
                      label="Country"
                      placeholder="Select country"
                      options={COUNTRIES}
                      searchable
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
                      label="Mobile Number"
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
                    <Pressable style={[styles.logoBox, webOnly({ cursor: 'pointer' })]} onPress={pickLogo}>
                      {logo ? (
                        <Image source={{ uri: logo.uri }} style={styles.logoPreview} />
                      ) : (
                        <Ionicons name="camera-outline" size={34} color={colors.textMuted} />
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
                  </>
                ) : null}

                {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

                <View style={styles.actions}>
                  {step > 1 ? (
                    <View style={styles.backBtn}>
                      <AppButton title="Back" variant="outline" onPress={onBack} />
                    </View>
                  ) : null}
                  <View style={styles.nextBtn}>
                    {step < 3 ? (
                      <AppButton title="Continue" variant="primary" onPress={onNext} />
                    ) : (
                      <AppButton title="Finish Setup" variant="primary" onPress={onFinish} loading={submitting} />
                    )}
                  </View>
                </View>
              </View>
            </Reveal>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bgPage },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgWhite,
  },
  // Balances the step counter so the brand stays centred.
  topbarSide: { width: 84 },
  stepCount: { width: 84, textAlign: 'right', fontSize: 12, fontWeight: '600', color: colors.textMuted },

  scrollBody: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  cardWrap: { width: '100%', maxWidth: 560 },
  card: {
    backgroundColor: colors.bgWhite,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    ...shadows.md,
  },

  progress: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  segmentDone: { backgroundColor: colors.accent },

  stepTitle: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.4, marginBottom: 6 },
  stepSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 24 },

  label: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginBottom: 4 },
  hint: { fontSize: 11, color: colors.textMuted, marginBottom: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgWhite,
  },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: '#FFFFFF' },

  logoBox: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.bgPage,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoPreview: { width: '100%', height: '100%' },
  logoHint: { textAlign: 'center', fontSize: 12, color: colors.textMuted, marginTop: 10, marginBottom: 22 },

  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 8, textAlign: 'center' },

  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
});
