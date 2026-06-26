import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { InventoryForm, type InventoryFormInitial } from '../components/inventory/InventoryForm';
import { getInventoryDetail, updateInventory, type InventoryInput } from '../services/supabase/inventory';
import { uploadInventoryDocument, uploadInventoryPhoto, type UploadFile } from '../services/supabase/storage';
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

  const onSubmit = async (input: InventoryInput, photos: UploadFile[], docs: UploadFile[]): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await updateInventory(inventoryId, input);
      await Promise.all([
        ...photos.map((p) => uploadInventoryPhoto(inventoryId, p)),
        ...docs.map((d) => uploadInventoryDocument(inventoryId, d)),
      ]);
      toast.success('Item updated successfully!');
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save changes.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.fill}>
      <ScreenHeader title="Edit Item" onBack={() => navigation.goBack()} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{loadError instanceof Error ? loadError.message : 'Failed to load.'}</Text>
          <Pressable onPress={() => void refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <InventoryForm
          initial={toInitial(data.item, data.photoUrls, data.documents)}
          submitLabel="Save Changes"
          submitting={submitting}
          error={error}
          onSubmit={onSubmit}
        />
      )}
    </View>
  );
}

function toInitial(
  item: Awaited<ReturnType<typeof getInventoryDetail>>['item'],
  photoUrls: string[],
  documents: Awaited<ReturnType<typeof getInventoryDetail>>['documents'],
): InventoryFormInitial {
  return {
    values: {
      title: item.title,
      productCode: item.product_code ?? '',
      category: item.category ?? '',
      quantity: String(item.quantity),
      unit: item.unit,
      price: item.price !== null ? String(item.price) : '',
      currency: item.currency,
      origin: item.origin ?? '',
      stockLocation: item.stock_location ?? '',
      description: item.description ?? '',
    },
    existingPhotoUrls: photoUrls,
    existingDocs: documents.map((d) => ({ name: d.name })),
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  retry: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.navy, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
