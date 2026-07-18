import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BrandLoader } from '../components/shared/BrandLoader';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { AddItemForm, type AddItemFormInitial, type RemovedAttachments } from '../components/inventory/AddItemForm';
import { getInventoryDetail, updateInventory, type InventoryInput } from '../services/supabase/inventory';
import {
  deleteInventoryDocument,
  deleteInventoryPhoto,
  uploadInventoryDocument,
  uploadInventoryPhoto,
  type UploadFile,
} from '../services/supabase/storage';
import { toast } from '../stores/toast';
import { Button, NavBar, ScreenBackground, colors, layout, spacing } from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'InventoryEdit'>;

/**
 * Edit item (prototype SCREENS.editItem, edit mode). Same update + upload +
 * remove logic as the web InventoryEditScreen; the form prefills from
 * getInventoryDetail.
 */
export function InventoryEditScreen({ navigation, route }: Props): React.JSX.Element {
  const { inventoryId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { data, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ['inventoryDetail', inventoryId],
    queryFn: () => getInventoryDetail(inventoryId),
    staleTime: 30_000,
  });

  const onSubmit = async (
    input: InventoryInput,
    photos: UploadFile[],
    docs: UploadFile[],
    removed: RemovedAttachments,
  ): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await updateInventory(inventoryId, input);
      await Promise.all([
        ...photos.map((p) => uploadInventoryPhoto(inventoryId, p)),
        ...docs.map((d) => uploadInventoryDocument(inventoryId, d)),
        ...removed.photoPaths.map((path) => deleteInventoryPhoto(path)),
        ...removed.docPaths.map((path) => deleteInventoryDocument(path)),
      ]);
      void queryClient.invalidateQueries({ queryKey: ['inventoryDetail', inventoryId] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Item updated successfully!');
      navigation.navigate('InventoryDetail', { inventoryId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save changes.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenBackground>
      <NavBar title="Edit item" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {isLoading ? (
          <View style={styles.center}>
            <BrandLoader mode="loop" size={150} />
          </View>
        ) : isError || !data ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{loadError instanceof Error ? loadError.message : 'Failed to load.'}</Text>
            <Button label="Retry" variant="ghost" size="sm" onPress={() => void refetch()} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingTop: insets.top + layout.navHeight - 56, paddingBottom: insets.bottom + 40 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AddItemForm
              initial={toInitial(data.item)}
              existingPhotos={data.photoUrls.map((url, i) => ({ url, path: data.photoPaths[i] }))}
              existingDocs={data.documents.map((d) => ({ name: d.name, path: d.storage_path }))}
              submitLabel="Save changes"
              submitting={submitting}
              error={error}
              onSubmit={onSubmit}
              onCancel={() => navigation.goBack()}
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

function toInitial(item: Awaited<ReturnType<typeof getInventoryDetail>>['item']): AddItemFormInitial {
  return {
    title: item.title,
    productCode: item.product_code ?? '',
    industry: item.industry ?? '',
    category: item.category ?? '',
    quantity: String(item.quantity),
    unit: item.unit,
    price: item.price !== null ? String(item.price) : '',
    currency: item.currency,
    origin: item.origin ?? '',
    stockLocation: item.stock_location ?? '',
    description: item.description ?? '',
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  errorText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
