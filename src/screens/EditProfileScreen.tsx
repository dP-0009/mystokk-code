import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useForm } from 'react-hook-form';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { LoadingState } from '../components/shared/StateView';
import { FormTextField } from '../components/shared/FormTextField';
import { SelectField } from '../components/shared/SelectField';
import { AppButton } from '../components/shared/AppButton';
import { getMyVendor, updateVendorProfile, type VendorProfile } from '../services/supabase/vendor';
import { toast } from '../stores/toast';
import { uploadCompanyLogo, type UploadFile } from '../services/supabase/storage';
import { useAuthStore } from '../stores/authStore';
import { COUNTRIES } from '../constants/industries';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

interface FormShape {
  companyName: string;
  contactPerson: string;
  country: string;
  city: string;
  address: string;
  mobileNumber: string;
  telCountryCode: string;
  telNumber: string;
  description: string;
}

function initials(name: string | null): string {
  if (!name) return 'MS';
  const parts = name.trim().split(/\s+/);
  return (parts.slice(0, 2).map((p) => p[0] ?? '').join('') || 'MS').toUpperCase();
}

export function EditProfileScreen({ navigation }: Props): React.JSX.Element {
  const { data: vendor, isLoading } = useQuery({ queryKey: ['myVendor'], queryFn: getMyVendor, staleTime: 30_000 });

  return (
    <View style={styles.fill}>
      <ScreenHeader title="Edit Profile" onBack={() => navigation.goBack()} />
      {isLoading || !vendor ? (
        <LoadingState />
      ) : (
        <ProfileForm vendor={vendor} onDone={() => navigation.goBack()} />
      )}
    </View>
  );
}

function ProfileForm({ vendor, onDone }: { vendor: VendorProfile; onDone: () => void }): React.JSX.Element {
  const queryClient = useQueryClient();
  const refreshVendor = useAuthStore((s) => s.refreshVendor);
  const [logo, setLogo] = useState<UploadFile | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(vendor.logo_url);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<FormShape>({
    defaultValues: {
      companyName: vendor.company_name ?? '',
      contactPerson: vendor.contact_person ?? '',
      country: vendor.country ?? '',
      city: vendor.city ?? '',
      address: vendor.address ?? '',
      mobileNumber: vendor.mobile_number ?? '',
      telCountryCode: vendor.tel_country_code ?? '',
      telNumber: vendor.tel_number ?? '',
      description: vendor.description ?? '',
    },
  });

  const pickLogo = async (): Promise<void> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (res.canceled || res.assets.length === 0) return;
    const a = res.assets[0];
    setLogo({ uri: a.uri, name: a.fileName ?? `logo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg' });
    setLogoUrl(a.uri);
  };

  const submit = handleSubmit(async (v) => {
    setError(null);
    setSubmitting(true);
    try {
      if (logo) await uploadCompanyLogo(vendor.id, logo);
      await updateVendorProfile({
        companyName: v.companyName,
        contactPerson: v.contactPerson,
        country: v.country,
        city: v.city,
        address: v.address,
        mobileNumber: v.mobileNumber,
        telCountryCode: v.telCountryCode,
        telNumber: v.telNumber,
        description: v.description,
      });
      await refreshVendor(); // re-evaluate profile_complete for the Share gate
      void queryClient.invalidateQueries({ queryKey: ['myVendor'] });
      void queryClient.invalidateQueries({ queryKey: ['profileStats'] });
      toast.success('Profile saved successfully!');
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save changes.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.logoBox} onPress={() => void pickLogo()}>
        {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logoImg} /> : <Text style={styles.logoText}>{initials(vendor.company_name)}</Text>}
      </Pressable>
      <Text style={styles.logoHint}>Tap to change logo</Text>

      <FormTextField control={control} name="companyName" label="Company Name *" autoCapitalize="words" rules={{ required: 'Company name is required' }} />
      <FormTextField control={control} name="contactPerson" label="Contact Person *" autoCapitalize="words" rules={{ required: 'Contact person is required' }} />

      <Text style={styles.roLabel}>Industry</Text>
      <View style={styles.roField}>
        <Text style={styles.roValue}>{vendor.industry ?? '—'}</Text>
      </View>

      <SelectField control={control} name="country" label="Country" placeholder="Select country" options={COUNTRIES} required rules={{ required: 'Country is required' }} />
      <FormTextField control={control} name="city" label="City *" autoCapitalize="words" rules={{ required: 'City is required' }} />
      <FormTextField control={control} name="address" label="Address" autoCapitalize="words" />
      <View style={styles.row}>
        <View style={styles.flex1}>
          <FormTextField control={control} name="mobileNumber" label="Mobile *" keyboardType="phone-pad" rules={{ required: 'Mobile is required' }} />
        </View>
        <View style={styles.flex1}>
          <FormTextField control={control} name="telNumber" label="Telephone" placeholder="Optional" keyboardType="phone-pad" />
        </View>
      </View>
      <FormTextField control={control} name="description" label="Description" autoCapitalize="sentences" multiline />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AppButton title="Save Changes" onPress={() => void submit()} loading={submitting} style={styles.submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  body: { padding: 20, paddingBottom: 40 },
  logoBox: { alignSelf: 'center', width: 96, height: 96, borderRadius: 22, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%' },
  logoText: { color: '#FFFFFF', fontWeight: '800', fontSize: 30 },
  logoHint: { textAlign: 'center', fontSize: 12, color: colors.slate400, marginTop: 8, marginBottom: 18 },
  roLabel: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginBottom: 6 },
  roField: { borderWidth: 1.5, borderColor: colors.slate100, borderRadius: 10, backgroundColor: colors.slate50, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16 },
  roValue: { fontSize: 14, color: colors.slate500 },
  row: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  submit: { marginTop: 20 },
});
