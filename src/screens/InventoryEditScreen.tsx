import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { AddItemForm, type AddItemFormInitial, type RemovedAttachments } from '../components/inventory/AddItemForm';
import { ErrorState, LoadingState } from '../components/shared/StateView';
import { getInventoryDetail, updateInventory, type InventoryInput } from '../services/supabase/inventory';
import {
  deleteInventoryDocument,
  deleteInventoryPhoto,
  uploadInventoryDocument,
  uploadInventoryPhoto,
  type UploadFile,
} from '../services/supabase/storage';
import { colors } from '../theme/tokens';
import { toast } from '../stores/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'InventoryEdit'>;

export function InventoryEditScreen({ navigation, route }: Props): React.JSX.Element {
  const { inventoryId } = route.params;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // The form now collects Industry + Category, so save them as submitted.
      await updateInventory(inventoryId, input);
      await Promise.all([
        ...photos.map((p) => uploadInventoryPhoto(inventoryId, p)),
        ...docs.map((d) => uploadInventoryDocument(inventoryId, d)),
        ...removed.photoPaths.map((path) => deleteInventoryPhoto(path)),
        ...removed.docPaths.map((path) => deleteInventoryDocument(path)),
      ]);
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
    <MainLayout active="inventory">
      <PageHeader
        title="Edit Item"
        leading={
          <Pressable style={styles.back} onPress={() => navigation.goBack()} hitSlop={6}>
            <Ionicons name="arrow-back" size={15} color={colors.textSecondary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        }
      />
      <PageBody>
        <View style={styles.container}>
          {isLoading ? (
            <LoadingState />
          ) : isError || !data ? (
            <ErrorState
              message={loadError instanceof Error ? loadError.message : 'Failed to load.'}
              onRetry={() => void refetch()}
            />
          ) : (
            <AddItemForm
              initial={toInitial(data.item)}
              existingPhotos={data.photoUrls.map((url, i) => ({ url, path: data.photoPaths[i] }))}
              existingDocs={data.documents.map((d) => ({ name: d.name, path: d.storage_path }))}
              submitLabel="Save Changes"
              submitting={submitting}
              error={error}
              onSubmit={onSubmit}
              onCancel={() => navigation.goBack()}
            />
          )}
        </View>
      </PageBody>
    </MainLayout>
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
  // Max content width 720px, centered — matches the Add New Item page.
  container: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  backText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
