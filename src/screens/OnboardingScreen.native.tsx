import React from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { onboardVendor } from '../services/supabase/vendor';
import { uploadCompanyLogo, type UploadFile } from '../services/supabase/storage';
import { requestPushPermissionAndRegister } from '../services/push';
import { useAuthStore } from '../stores/authStore';
import { COUNTRIES, SETTINGS_INDUSTRIES, SETTINGS_INDUSTRY_CATEGORIES } from '../constants/industries';
import { DIAL_OPTIONS, dialForCountry, dialFromOption, splitPhone } from '../constants/countries';
import {
  Button,
  CategoryChip,
  CategoryChipGroup,
  Icon,
  NavBar,
  PickerSheet,
  ScreenBackground,
  Select,
  Steps,
  TextArea,
  TextField,
  colors,
  layout,
  spacing,
} from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

/** Identical shape + field names to the web wizard — onboardVendor's payload. */
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

const STEP_COPY: Record<number, { title: string; sub: string }> = {
  1: { title: 'Tell us about your company', sub: 'This appears on every share you send to your network' },
  2: { title: 'Where are you based?', sub: 'Helps vendors filter their network by location' },
  3: { title: 'Add your company logo', sub: 'Shown on share cards and your public profile' },
};

const DEFAULT_DIAL = '+971';

/** Phone value is stored exactly as the web PhoneField stores it: `${dial}${number}`. */
function combinePhone(dial: string, number: string): string {
  return number ? `${dial}${number}` : '';
}

type PickerId = 'industry' | 'country' | 'mobileDial' | 'telDial' | null;

/**
 * Onboarding (prototype SCREENS.onboard1-3). Presentation only: the submit path,
 * payload, field names and post-finish behaviour are the web wizard's, unchanged.
 */
export function OnboardingScreen(_props: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
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

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [logo, setLogo] = React.useState<UploadFile | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [picker, setPicker] = React.useState<PickerId>(null);

  const country = watch('country');
  const industry = watch('industry');
  const categoryOptions = SETTINGS_INDUSTRY_CATEGORIES[industry] ?? [];

  // Changing industry drops any selected category that no longer belongs to it.
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const allowed = SETTINGS_INDUSTRY_CATEGORIES[industry] ?? [];
    setValue('categories', (getValues('categories') ?? []).filter((c) => allowed.includes(c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry]);

  // Picking a country auto-fills the mobile dial code, as PhoneField does on web.
  React.useEffect(() => {
    const dial = dialForCountry(country);
    if (!dial) return;
    const current = splitPhone(getValues('mobileNumber'));
    setValue('mobileNumber', combinePhone(dial, current.number));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  const onNext = async (): Promise<void> => {
    const fields = step === 1 ? STEP1_FIELDS : STEP2_FIELDS;
    const valid = await trigger([...fields]);
    if (valid) setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  };

  const onBack = (): void => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));

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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Flip onboarded=true → reactive navigator advances to Main.
      await refreshVendor();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not finish setup.');
    } finally {
      setSubmitting(false);
    }
  });

  const copy = STEP_COPY[step];
  const mobile = splitPhone(watch('mobileNumber'));
  const tel = splitPhone(watch('telNumber'));

  return (
    <ScreenBackground>
      <NavBar title={`Step ${step} of 3`} onBack={step > 1 ? onBack : undefined} />

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + 120 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Steps total={3} current={step} />
          <Text style={styles.h1}>{copy.title}</Text>
          <Text style={styles.sub}>{copy.sub}</Text>

          {step === 1 ? (
            <>
              <Controller
                control={control}
                name="companyName"
                rules={{ required: 'Company name is required' }}
                render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
                  <TextField
                    label="Company name"
                    required
                    placeholder="Ever Global Trading LLC"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={error?.message}
                    autoCapitalize="words"
                  />
                )}
              />
              <Controller
                control={control}
                name="contactPerson"
                rules={{ required: 'Contact person is required' }}
                render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
                  <TextField
                    label="Contact person"
                    required
                    placeholder="Your name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={error?.message}
                    autoCapitalize="words"
                  />
                )}
              />
              <Controller
                control={control}
                name="industry"
                rules={{ required: 'Industry is required' }}
                render={({ field: { value }, fieldState: { error } }) => (
                  <Select
                    label="Industry"
                    required
                    placeholder="Select industry"
                    value={value || undefined}
                    error={error?.message}
                    onPress={() => setPicker('industry')}
                  />
                )}
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
                  <CategoryChipGroup>
                    {categoryOptions.map((cat) => (
                      <CategoryChip
                        key={cat}
                        label={cat}
                        selected={value.includes(cat)}
                        onPress={() =>
                          onChange(value.includes(cat) ? value.filter((c) => c !== cat) : [...value, cat])
                        }
                      />
                    ))}
                  </CategoryChipGroup>
                )}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Controller
                control={control}
                name="country"
                rules={{ required: 'Country is required' }}
                render={({ field: { value }, fieldState: { error } }) => (
                  <Select
                    label="Country"
                    required
                    placeholder="Select country"
                    value={value || undefined}
                    error={error?.message}
                    onPress={() => setPicker('country')}
                  />
                )}
              />
              <Controller
                control={control}
                name="city"
                rules={{ required: 'City is required' }}
                render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
                  <TextField
                    label="City"
                    required
                    placeholder="Dubai"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={error?.message}
                    autoCapitalize="words"
                  />
                )}
              />
              <Controller
                control={control}
                name="address"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    label="Address"
                    placeholder="Street address, building, area"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                  />
                )}
              />

              {/* Mobile — dial code + number, stored combined as `${dial}${number}`. */}
              <Controller
                control={control}
                name="mobileNumber"
                rules={{ required: 'Mobile number is required' }}
                render={({ field: { value, onChange }, fieldState: { error } }) => {
                  const parts = splitPhone(value);
                  const dial = parts.dial || DEFAULT_DIAL;
                  return (
                    <View style={styles.phoneRow}>
                      <Select
                        label="Code"
                        value={dial}
                        onPress={() => setPicker('mobileDial')}
                        style={styles.dial}
                      />
                      <TextField
                        label="Mobile number"
                        required
                        placeholder="5X XXX XXXX"
                        value={parts.number}
                        onChangeText={(n) => onChange(combinePhone(dial, n.replace(/[^0-9]/g, '')))}
                        error={error?.message}
                        keyboardType="phone-pad"
                        style={styles.phoneNumber}
                      />
                    </View>
                  );
                }}
              />

              <Controller
                control={control}
                name="telNumber"
                render={({ field: { value, onChange } }) => {
                  const parts = splitPhone(value);
                  const dial = parts.dial || DEFAULT_DIAL;
                  return (
                    <View style={styles.phoneRow}>
                      <Select
                        label="Code"
                        value={dial}
                        onPress={() => setPicker('telDial')}
                        style={styles.dial}
                      />
                      <TextField
                        label="Telephone (optional)"
                        placeholder="Telephone"
                        value={parts.number}
                        onChangeText={(n) => onChange(combinePhone(dial, n.replace(/[^0-9]/g, '')))}
                        keyboardType="phone-pad"
                        style={styles.phoneNumber}
                      />
                    </View>
                  );
                }}
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Pressable style={styles.logoBox} onPress={() => void pickLogo()}>
                {logo ? (
                  <Image source={{ uri: logo.uri }} style={styles.logoPreview} />
                ) : (
                  <Icon name="camera" size={30} color={colors.blue} />
                )}
              </Pressable>
              <Text style={styles.logoHint}>
                {logo ? 'Tap to change' : 'Tap to choose from your gallery'}
              </Text>

              <Controller
                control={control}
                name="description"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextArea
                    label="Company description"
                    placeholder="A short description of what you trade…"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="sentences"
                  />
                )}
              />
            </>
          ) : null}

          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky CTA (prototype .cta) */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 20 }]}>
        {step > 1 ? (
          <Button label="Back" variant="ghost" onPress={onBack} style={styles.backBtn} />
        ) : null}
        <View style={styles.nextBtn}>
          {step < 3 ? (
            <Button label="Continue" variant="primary" onPress={() => void onNext()} />
          ) : (
            <Button
              label="Finish setup"
              variant="primary"
              onPress={() => void onFinish()}
              disabled={submitting}
            />
          )}
        </View>
      </View>

      <PickerSheet
        open={picker === 'industry'}
        onClose={() => setPicker(null)}
        title="Industry"
        options={SETTINGS_INDUSTRIES}
        value={watch('industry')}
        onSelect={(v) => setValue('industry', v, { shouldValidate: true })}
      />
      <PickerSheet
        open={picker === 'country'}
        onClose={() => setPicker(null)}
        title="Country"
        options={COUNTRIES}
        value={watch('country')}
        onSelect={(v) => setValue('country', v, { shouldValidate: true })}
      />
      <PickerSheet
        open={picker === 'mobileDial'}
        onClose={() => setPicker(null)}
        title="Country code"
        options={DIAL_OPTIONS}
        onSelect={(opt) =>
          setValue('mobileNumber', combinePhone(dialFromOption(opt), mobile.number), {
            shouldValidate: true,
          })
        }
      />
      <PickerSheet
        open={picker === 'telDial'}
        onClose={() => setPicker(null)}
        title="Country code"
        options={DIAL_OPTIONS}
        onSelect={(opt) => setValue('telNumber', combinePhone(dialFromOption(opt), tel.number))}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter },
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.navy },
  sub: { fontSize: 14.5, color: colors.muted, marginTop: 3, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '800', color: colors.navy },
  hint: { fontSize: 12.5, color: colors.muted, fontWeight: '600', marginTop: 2, marginBottom: 8 },

  phoneRow: { flexDirection: 'row', gap: 11 },
  dial: { width: 112 },
  phoneNumber: { flex: 1 },

  logoBox: {
    alignSelf: 'center',
    width: 132,
    height: 132,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.dashed,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(243,248,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  logoPreview: { width: '100%', height: '100%' },
  logoHint: { textAlign: 'center', fontSize: 13, color: colors.muted, fontWeight: '600', marginBottom: 22 },

  error: { color: colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 },

  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.gutter,
    paddingTop: 12,
  },
  backBtn: { width: 110 },
  nextBtn: { flex: 1 },
});
