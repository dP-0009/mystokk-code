import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { AddItemForm, type AddItemFormInitial, type RemovedAttachments } from '../components/inventory/AddItemForm';
import { ShareModal } from '../components/share/ShareModal';
import { getReceivedShareDetail } from '../services/supabase/received';
import { createInventory, type InventoryInput } from '../services/supabase/inventory';
import { uploadInventoryDocument, uploadInventoryPhoto, type UploadFile } from '../services/supabase/storage';
import { toast } from '../stores/toast';
import { Button, NavBar, ScreenBackground, colors, layout, spacing } from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceivedEdit'>;

/** Map a document filename to a bucket-accepted MIME type (by extension). */
const DOC_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};
function docMime(name: string): string {
  return DOC_MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/pdf';
}
function imageMime(url: string): string {
  const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/**
 * Edit a RECEIVED item (native, prototype SCREENS.editReceived) → save it as a
 * NEW item in "My Inventory" (the editor becomes the owner). Same load + copy +
 * create-with-provenance logic as the web ReceivedEditScreen; the presentation
 * matches the native Add/Edit item screen (ScreenBackground, glass back NavBar,
 * amber ownership note, shared form, Save + Save & Share).
 */
export function ReceivedEditScreen({ navigation, route }: Props): React.JSX.Element {
  const { shareId } = route.params;
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // After "Save & Share" we hold the new item so the share popup can open on it.
  const [shareFor, setShareFor] = React.useState<{ id: string; title: string; quantity: number; available: number; unit: string } | null>(null);

  const { data, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ['receivedDetail', shareId],
    queryFn: () => getReceivedShareDetail(shareId),
    staleTime: 30_000,
  });

  const initial: AddItemFormInitial | undefined = React.useMemo(() => {
    if (!data) return undefined;
    return {
      productCode: data.product_code ?? '',
      title: data.title,
      quantity: String(data.quantity),
      unit: data.unit,
      category: data.category ?? '',
      price: data.display_price !== null ? String(data.display_price) : '',
      currency: data.display_currency ?? 'AED',
      origin: data.origin ?? '',
      stockLocation: data.stock_location ?? '',
      description: data.description ?? '',
    };
  }, [data]);

  // Seed the source photos/documents as uploads so the new copy owns its own files.
  const initialPhotos: UploadFile[] = React.useMemo(
    () => (data?.photoUrls ?? []).map((url, i) => ({ uri: url, name: `photo-${i + 1}.jpg`, mimeType: imageMime(url) })),
    [data],
  );
  const initialDocs: UploadFile[] = React.useMemo(
    () => (data?.files ?? []).map((f) => ({ uri: f.url, name: f.name, mimeType: docMime(f.name) })),
    [data],
  );

  const saveNewItem = async (input: InventoryInput, photos: UploadFile[], docs: UploadFile[]): Promise<string> => {
    const inventoryId = await createInventory(input, {
      editedFromShareId: shareId,
      editedFromCompany: data?.shared_by_company ?? null,
      editedFromTitle: data?.title ?? null,
    });
    await Promise.all([
      ...photos.map((p) => uploadInventoryPhoto(inventoryId, p)),
      ...docs.map((d) => uploadInventoryDocument(inventoryId, d)),
    ]);
    return inventoryId;
  };

  const onSave = async (input: InventoryInput, photos: UploadFile[], docs: UploadFile[], _removed: RemovedAttachments): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      const inventoryId = await saveNewItem(input, photos, docs);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Saved to My Inventory!');
      navigation.replace('InventoryDetail', { inventoryId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onSaveAndShare = async (input: InventoryInput, photos: UploadFile[], docs: UploadFile[], _removed: RemovedAttachments): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      const inventoryId = await saveNewItem(input, photos, docs);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Saved to My Inventory!');
      setShareFor({
        id: inventoryId,
        title: input.title,
        quantity: input.quantity,
        available: input.quantity,
        unit: input.unit,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenBackground>
      <NavBar title="Edit Received Item" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.blue} size="large" />
          </View>
        ) : isError || !data || !initial ? (
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
              initial={initial}
              initialPhotos={initialPhotos}
              initialDocs={initialDocs}
              warning="This edited copy will be saved to your “My Inventory” page — you become its owner. The original stays with the sender."
              submitLabel="Save"
              secondarySubmitLabel="Save & Share"
              submitting={submitting}
              error={error}
              onSubmit={onSave}
              onSecondarySubmit={onSaveAndShare}
              onCancel={() => navigation.goBack()}
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Save & Share → share the newly-created owned item (provenance is never forwarded). */}
      {shareFor ? (
        <ShareModal
          visible
          inventoryId={shareFor.id}
          card={{
            title: shareFor.title,
            quantityAvailable: shareFor.available,
            quantityTotal: shareFor.quantity,
            unit: shareFor.unit,
          }}
          onClose={() => {
            const id = shareFor.id;
            setShareFor(null);
            navigation.replace('InventoryDetail', { inventoryId: id });
          }}
        />
      ) : null}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: spacing.gutter },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  errorText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
