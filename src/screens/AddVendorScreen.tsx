import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { FormTextField } from '../components/shared/FormTextField';
import { PhoneField } from '../components/shared/PhoneField';
import { SelectField } from '../components/shared/SelectField';
import { AppButton } from '../components/shared/AppButton';
import { addManualVendor } from '../services/supabase/network';
import { INDUSTRIES, COUNTRIES } from '../constants/industries';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AddVendor'>;

interface FormShape {
  companyName: string;
  contactPerson: string;
  email: string;
  mobileNumber: string;
  industry: string;
  country: string;
  city: string;
  groupName: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddVendorScreen({ navigation }: Props): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, watch } = useForm<FormShape>({
    defaultValues: {
      companyName: '',
      contactPerson: '',
      email: '',
      mobileNumber: '',
      industry: '',
      country: '',
      city: '',
      groupName: '',
    },
  });
  const country = watch('country');

  const submit = handleSubmit(async (v) => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await addManualVendor({
        companyName: v.companyName,
        contactPerson: v.contactPerson,
        email: v.email,
        mobileNumber: v.mobileNumber,
        industry: v.industry,
        country: v.country,
        city: v.city,
        groupName: v.groupName,
      });
      Alert.alert(
        result.connected ? 'Connected' : 'Vendor added',
        result.connected
          ? `${result.company ?? 'This vendor'} already has a MyStokk account — you're now connected.`
          : `${result.company ?? 'The vendor'} was saved as a manual contact. You can still share with them by email.`,
      );
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add vendor.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <View style={styles.fill}>
      <ScreenHeader title="Add Vendor Manually" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          If this email already has a MyStokk account, you'll connect automatically. Otherwise they're saved as a
          manual contact you can still share with via email.
        </Text>

        <FormTextField
          control={control}
          name="companyName"
          label="Company Name *"
          placeholder="e.g. Spinneys Distribution"
          autoCapitalize="words"
          rules={{ required: 'Company name is required' }}
        />
        <FormTextField control={control} name="contactPerson" label="Contact Person" placeholder="Full name" autoCapitalize="words" />
        <FormTextField
          control={control}
          name="email"
          label="Email *"
          placeholder="contact@company.com"
          keyboardType="email-address"
          rules={{
            required: 'Email is required',
            pattern: { value: EMAIL_RE, message: 'Enter a valid email' },
          }}
        />
        <PhoneField control={control} name="mobileNumber" label="Mobile Number" countryName={country} placeholder="Phone number" />
        <SelectField control={control} name="industry" label="Industry" placeholder="Select industry" options={INDUSTRIES} />
        <SelectField control={control} name="country" label="Country" placeholder="Select country" options={COUNTRIES} />
        <FormTextField control={control} name="city" label="City" placeholder="e.g. Dubai" autoCapitalize="words" />
        <FormTextField
          control={control}
          name="groupName"
          label="Group (optional)"
          placeholder="e.g. Suppliers UAE, VIP Buyers"
          autoCapitalize="words"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton title="Add Vendor" onPress={() => void submit()} loading={submitting} style={styles.submit} />
        <AppButton
          title="Or bulk import via CSV →"
          variant="outline"
          onPress={() => navigation.replace('BulkUpload')}
          style={styles.bulk}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  body: { padding: 20, paddingBottom: 40 },
  hint: {
    backgroundColor: colors.blueBg,
    color: colors.blue,
    padding: 12,
    borderRadius: 10,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  submit: { marginTop: 12 },
  bulk: { marginTop: 10 },
});
