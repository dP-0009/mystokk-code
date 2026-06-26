import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { AddItemForm } from '../components/inventory/AddItemForm';
import { createInventory, type InventoryInput } from '../services/supabase/inventory';
import { uploadInventoryDocument, uploadInventoryPhoto, type UploadFile } from '../services/supabase/storage';
import { colors } from '../theme/tokens';
import { toast } from '../stores/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'InventoryCreate'>;

/** The redesigned "Add New Item" page (mirror `/inventory/new`). */
export function InventoryCreateScreen({ navigation }: Props): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (input: InventoryInput, photos: UploadFile[], docs: UploadFile[]): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      const inventoryId = await createInventory(input);
      await Promise.all([
        ...photos.map((p) => uploadInventoryPhoto(inventoryId, p)),
        ...docs.map((d) => uploadInventoryDocument(inventoryId, d)),
      ]);
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
    <MainLayout active="inventory">
      <PageHeader
        title="Add New Item"
        leading={
          <Pressable style={styles.back} onPress={() => navigation.goBack()} hitSlop={6}>
            <Ionicons name="arrow-back" size={15} color={colors.textSecondary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        }
      />
      <PageBody>
        <View style={styles.container}>
          <AddItemForm
            submitting={submitting}
            error={error}
            onSubmit={onSubmit}
            onCancel={() => navigation.goBack()}
          />
        </View>
      </PageBody>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  // Max content width 720px, centered.
  container: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  backText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
