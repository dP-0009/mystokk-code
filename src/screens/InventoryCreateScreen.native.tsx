import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { AddItemForm } from '../components/inventory/AddItemForm';
import { createInventory, type InventoryInput } from '../services/supabase/inventory';
import { uploadInventoryDocument, uploadInventoryPhoto, type UploadFile } from '../services/supabase/storage';
import { toast } from '../stores/toast';
import { NavBar, ScreenBackground, colors, layout, spacing } from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'InventoryCreate'>;

/**
 * Add item (prototype SCREENS.editItem, add mode). Same create + upload logic as
 * the web InventoryCreateScreen — createInventory then upload photos/docs — only
 * the chrome differs.
 */
export function InventoryCreateScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (input: InventoryInput, photos: UploadFile[], docs: UploadFile[]): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      const inventoryId = await createInventory(input);
      await Promise.all([
        ...photos.map((p) => uploadInventoryPhoto(inventoryId, p)),
        ...docs.map((d) => uploadInventoryDocument(inventoryId, d)),
      ]);
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Inventory created successfully!');
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create item.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenBackground>
      <NavBar title="Add item" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AddItemForm
            submitting={submitting}
            error={error}
            onSubmit={onSubmit}
            onCancel={() => navigation.goBack()}
            submitLabel="Save item"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter },
});
