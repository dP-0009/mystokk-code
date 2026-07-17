import React from 'react';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { addManualVendor } from '../services/supabase/network';
import { VendorForm, type VendorFormValues } from '../components/network/VendorForm';
import { toast } from '../stores/toast';
import { NavBar, ScreenBackground } from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'AddVendor'>;

/**
 * Add vendor (prototype SCREENS.addVendor) — the shared VendorForm in ADD mode,
 * wired to the existing addManualVendor mutation. Only Email is mandatory.
 */
export function AddVendorScreen({ navigation }: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (v: VendorFormValues) =>
      addManualVendor({
        companyName: v.companyName.trim(),
        contactPerson: v.contactPerson.trim() || undefined,
        email: v.email.trim(),
        mobileNumber: v.mobile.trim() || undefined,
        industry: v.industry || undefined,
        country: v.country || undefined,
        city: v.city.trim() || undefined,
        groupName: v.group.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Vendor added to network');
      navigation.goBack();
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : 'Could not add vendor.';
      setError(message);
      toast.error(message);
    },
  });

  return (
    <ScreenBackground>
      <NavBar title="Add vendor" onBack={() => navigation.goBack()} />
      <VendorForm
        mode="add"
        submitLabel="Add vendor"
        submitting={mutation.isPending}
        error={error}
        onSubmit={(v) => mutation.mutate(v)}
      />
    </ScreenBackground>
  );
}
