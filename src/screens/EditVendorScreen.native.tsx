import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MystokkLoader } from '../components/shared/MystokkLoader';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import {
  getManualVendor,
  getVendorProfile,
  updateConnectionGroup,
  updateManualVendor,
  type ManualVendorRow,
  type VendorProfile,
} from '../services/supabase/network';
import { VendorForm, type VendorFormValues } from '../components/network/VendorForm';
import { toast } from '../stores/toast';
import { Button, NavBar, ScreenBackground, colors } from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'EditVendor'>;

const GROUP_ONLY_NOTE =
  'This vendor manages their own profile. You can file them under a group for your network.';

/**
 * Edit vendor (native, prototype SCREENS.editVendor) — the SAME glass VendorForm
 * as Add Vendor, prefilled and in EDIT mode. A manual contact is fully editable
 * (updateManualVendor); a registered connection is group-only, with the rest
 * shown read-only (updateConnectionGroup) — same privacy rule as the web screen.
 */
export function EditVendorScreen({ navigation, route }: Props): React.JSX.Element {
  const { vendorId, manualVendorId } = route.params;
  const isManual = Boolean(manualVendorId);
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  const { data, isLoading, isError, error: loadError, refetch } = useQuery<ManualVendorRow | VendorProfile>({
    queryKey: ['editVendor', manualVendorId ?? vendorId],
    queryFn: () => (isManual ? getManualVendor(manualVendorId as string) : getVendorProfile(vendorId as string)),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (v: VendorFormValues) => {
      if (isManual) {
        return updateManualVendor(manualVendorId as string, {
          company_name: v.companyName,
          contact_person: v.contactPerson,
          email: v.email,
          mobile_number: v.mobile,
          industry: v.industry,
          country: v.country,
          city: v.city,
          group_name: v.group,
        });
      }
      const profile = data as VendorProfile | undefined;
      if (!profile?.connection_id) throw new Error('This vendor has no editable connection.');
      return updateConnectionGroup(profile.connection_id, v.group.trim() || null);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network'] });
      void queryClient.invalidateQueries({ queryKey: ['vendorDetail'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Vendor updated');
      navigation.goBack();
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : 'Could not save.';
      setError(message);
      toast.error(message);
    },
  });

  const initial: Partial<VendorFormValues> | undefined = React.useMemo(() => {
    if (!data) return undefined;
    const row = data as Partial<ManualVendorRow & VendorProfile>;
    return {
      companyName: row.company_name ?? '',
      contactPerson: row.contact_person ?? '',
      email: row.email ?? '',
      mobile: row.mobile_number ?? '',
      industry: row.industry ?? '',
      city: row.city ?? '',
      country: row.country ?? '',
      group: row.group_name ?? '',
    };
  }, [data]);

  return (
    <ScreenBackground>
      <NavBar title="Edit Vendor" onBack={() => navigation.goBack()} />
      {isLoading || !data || !initial ? (
        isError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{loadError instanceof Error ? loadError.message : 'Failed to load.'}</Text>
            <Button label="Retry" variant="ghost" size="sm" onPress={() => void refetch()} />
          </View>
        ) : (
          <View style={styles.center}>
            <MystokkLoader />
          </View>
        )
      ) : (
        <VendorForm
          mode="edit"
          initial={initial}
          lockedExceptGroup={!isManual}
          note={!isManual ? GROUP_ONLY_NOTE : undefined}
          submitLabel="Save changes"
          submitting={mutation.isPending}
          error={error}
          onSubmit={(v) => mutation.mutate(v)}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  errorText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
