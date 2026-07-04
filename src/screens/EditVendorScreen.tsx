import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { FormTextField } from '../components/shared/FormTextField';
import { SelectField } from '../components/shared/SelectField';
import { AppButton } from '../components/shared/AppButton';
import { LoadingState } from '../components/shared/StateView';
import {
  getManualVendor,
  getVendorProfile,
  updateConnectionGroup,
  updateManualVendor,
  type ManualVendorRow,
  type VendorProfile,
} from '../services/supabase/network';
import { INDUSTRIES, COUNTRIES } from '../constants/industries';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'EditVendor'>;

interface ManualForm {
  company_name: string;
  contact_person: string;
  email: string;
  mobile_number: string;
  industry: string;
  country: string;
  city: string;
  group_name: string;
}

export function EditVendorScreen({ navigation, route }: Props): React.JSX.Element {
  const { vendorId, manualVendorId } = route.params;
  const isManual = Boolean(manualVendorId);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ManualVendorRow | VendorProfile>({
    queryKey: ['editVendor', manualVendorId ?? vendorId],
    queryFn: async () =>
      isManual ? await getManualVendor(manualVendorId as string) : await getVendorProfile(vendorId as string),
    staleTime: 30_000,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['network'] });
    void queryClient.invalidateQueries({ queryKey: ['vendorDetail'] });
  };

  return (
    <View style={styles.fill}>
      <ScreenHeader title="Edit Vendor" onBack={() => navigation.goBack()} />
      {isLoading || !data ? (
        <LoadingState />
      ) : isManual ? (
        <ManualVendorForm
          row={data as Awaited<ReturnType<typeof getManualVendor>>}
          onDone={() => {
            invalidate();
            navigation.goBack();
          }}
        />
      ) : (
        <ConnectionGroupForm
          profile={data as Awaited<ReturnType<typeof getVendorProfile>>}
          onDone={() => {
            invalidate();
            navigation.goBack();
          }}
        />
      )}
    </View>
  );
}

/** Manual contacts are fully editable (it's the caller's own manual_vendors row). */
function ManualVendorForm({
  row,
  onDone,
}: {
  row: Awaited<ReturnType<typeof getManualVendor>>;
  onDone: () => void;
}): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<ManualForm>({
    defaultValues: {
      company_name: row.company_name ?? '',
      contact_person: row.contact_person ?? '',
      email: row.email ?? '',
      mobile_number: row.mobile_number ?? '',
      industry: row.industry ?? '',
      country: row.country ?? '',
      city: row.city ?? '',
      group_name: row.group_name ?? '',
    },
  });

  const submit = handleSubmit(async (v) => {
    setError(null);
    setSubmitting(true);
    try {
      await updateManualVendor(row.id, v);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <FormTextField control={control} name="company_name" label="Company Name *" autoCapitalize="words" rules={{ required: 'Company name is required' }} />
      <FormTextField control={control} name="contact_person" label="Contact Person" autoCapitalize="words" />
      <FormTextField control={control} name="email" label="Email" keyboardType="email-address" />
      <FormTextField control={control} name="mobile_number" label="Mobile Number" keyboardType="phone-pad" />
      <SelectField control={control} name="industry" label="Industry" placeholder="Select industry" options={INDUSTRIES} />
      <SelectField control={control} name="country" label="Country" placeholder="Select country" options={COUNTRIES} />
      <FormTextField control={control} name="city" label="City" autoCapitalize="words" />
      <FormTextField control={control} name="group_name" label="Group" placeholder="e.g. Suppliers UAE" autoCapitalize="words" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AppButton title="Save Changes" onPress={() => void submit()} loading={submitting} style={styles.submit} />
    </ScrollView>
  );
}

/** For a registered connection you can only edit the group label you filed them under. */
function ConnectionGroupForm({
  profile,
  onDone,
}: {
  profile: Awaited<ReturnType<typeof getVendorProfile>>;
  onDone: () => void;
}): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<{ group_name: string }>({
    defaultValues: { group_name: profile.group_name ?? '' },
  });

  const submit = handleSubmit(async (v) => {
    if (!profile.connection_id) {
      setError('This vendor has no editable connection.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updateConnectionGroup(profile.connection_id, v.group_name);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.note}>This vendor manages their own profile. You can file them under a group for your network.</Text>
      <ReadOnly label="Company" value={profile.company_name} />
      <ReadOnly label="Contact" value={profile.contact_person} />
      <ReadOnly label="Email" value={profile.email} />
      <ReadOnly label="Mobile" value={profile.mobile_number} />
      <FormTextField control={control} name="group_name" label="Group" placeholder="e.g. Suppliers UAE" autoCapitalize="words" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AppButton title="Save Changes" onPress={() => void submit()} loading={submitting} style={styles.submit} />
    </ScrollView>
  );
}

function ReadOnly({ label, value }: { label: string; value: string | null }): React.JSX.Element {
  return (
    <View style={styles.roGroup}>
      <Text style={styles.roLabel}>{label}</Text>
      <View style={styles.roField}>
        <Text style={styles.roValue}>{value ?? '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  body: { padding: 20, paddingBottom: 40 },
  note: { fontSize: 12.5, color: colors.slate500, marginBottom: 16, lineHeight: 18 },
  roGroup: { marginBottom: 16 },
  roLabel: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginBottom: 6 },
  roField: { borderWidth: 1.5, borderColor: colors.slate100, borderRadius: 10, backgroundColor: colors.slate50, paddingHorizontal: 14, paddingVertical: 13 },
  roValue: { fontSize: 14, color: colors.slate500 },
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  submit: { marginTop: 20 },
});
