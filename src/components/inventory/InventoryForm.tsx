import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useForm } from 'react-hook-form';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { FormTextField } from '../shared/FormTextField';
import { SelectField } from '../shared/SelectField';
import { AppButton } from '../shared/AppButton';
import type { InventoryInput } from '../../services/supabase/inventory';
import type { UploadFile } from '../../services/supabase/storage';
import {
  INVENTORY_INDUSTRIES,
  INVENTORY_INDUSTRY_CATEGORIES,
  industryForCategory,
} from '../../constants/industries';
import { CURRENCIES, UNITS } from '../../constants/inventory';
import { colors } from '../../theme/tokens';

interface FormShape {
  title: string;
  productCode: string;
  industry: string;
  category: string;
  quantity: string;
  unit: string;
  price: string;
  currency: string;
  origin: string;
  stockLocation: string;
  description: string;
}

export interface InventoryFormInitial {
  values?: Partial<FormShape>;
  existingPhotoUrls?: string[];
  /** Documents already saved on the item — shown read-only above newly-added ones. */
  existingDocs?: { name: string }[];
}

interface InventoryFormProps {
  initial?: InventoryFormInitial;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: InventoryInput, newPhotos: UploadFile[], newDocs: UploadFile[]) => void | Promise<void>;
}

const NUMERIC = /^\d*\.?\d*$/;

/**
 * Maps a file extension to a content type the `inventory-documents` bucket
 * accepts. The OS/browser often reports `application/octet-stream` for office
 * files, which the bucket rejects — so we resolve a real type from the name.
 */
const DOC_MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const ALLOWED_DOC_MIMES = new Set(Object.values(DOC_MIME_BY_EXT));

/** Resolves an upload-safe document content type from the picker mime + filename. */
function resolveDocMime(reported: string | undefined, name: string): string {
  if (reported && ALLOWED_DOC_MIMES.has(reported)) return reported;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return DOC_MIME_BY_EXT[ext] ?? reported ?? 'application/pdf';
}

export function InventoryForm({
  initial,
  submitLabel,
  submitting,
  error,
  onSubmit,
}: InventoryFormProps): React.JSX.Element {
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormShape>({
    defaultValues: {
      title: '',
      productCode: '',
      // Industry is a form-only filter (not persisted); seed it from the
      // existing category so the Category list resolves correctly on edit.
      industry: industryForCategory(initial?.values?.category),
      category: '',
      quantity: '',
      unit: 'pcs',
      price: '',
      currency: 'AED',
      origin: '',
      stockLocation: '',
      description: '',
      ...initial?.values,
    },
  });

  // Category options follow the chosen industry. A pre-existing category that
  // isn't in the mapping (legacy data) is preserved so editing never drops it.
  const industry = watch('industry');
  const category = watch('category');
  const categoryOptions = useMemo<readonly string[]>(() => {
    const base = industry ? INVENTORY_INDUSTRY_CATEGORIES[industry] ?? [] : [];
    if (category && !base.includes(category)) return [category, ...base];
    return base;
  }, [industry, category]);

  // Changing industry clears a category that no longer belongs to it.
  useEffect(() => {
    const current = getValues('category');
    if (industry && current && !(INVENTORY_INDUSTRY_CATEGORIES[industry] ?? []).includes(current)) {
      setValue('category', '', { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry]);

  const [photos, setPhotos] = useState<UploadFile[]>([]);
  const [docs, setDocs] = useState<UploadFile[]>([]);

  const pickPhotos = async (): Promise<void> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (res.canceled) return;
    setPhotos((prev) => [
      ...prev,
      ...res.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `photo-${Date.now()}.jpg`,
        mimeType: a.mimeType ?? 'image/jpeg',
      })),
    ]);
  };

  const pickDocs = async (): Promise<void> => {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return;
    setDocs((prev) => [
      ...prev,
      ...res.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        mimeType: resolveDocMime(a.mimeType, a.name),
      })),
    ]);
  };

  const removePhoto = (index: number): void =>
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  const removeDoc = (index: number): void =>
    setDocs((prev) => prev.filter((_, i) => i !== index));

  // Synchronous guard: blocks a second submission slipping through the render
  // gap before `isSubmitting` flips, so rapid clicks can't create duplicates.
  const submittingRef = useRef(false);
  const submit = handleSubmit(async (v) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const input: InventoryInput = {
        title: v.title,
        productCode: v.productCode,
        category: v.category,
        quantity: Number(v.quantity),
        unit: v.unit,
        price: v.price ? Number(v.price) : null,
        currency: v.currency,
        origin: v.origin,
        stockLocation: v.stockLocation,
        description: v.description,
      };
      await onSubmit(input, photos, docs);
    } finally {
      submittingRef.current = false;
    }
  });

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <FormTextField
        control={control}
        name="title"
        label="Product Title *"
        placeholder="e.g. Wireless Earbuds Pro — ANC"
        autoCapitalize="sentences"
        rules={{ required: 'Title is required' }}
      />
      <FormTextField control={control} name="productCode" label="Product Code / SKU" placeholder="WEP-2026-BLK" />
      <SelectField
        control={control}
        name="industry"
        label="Industry"
        placeholder="Select industry"
        options={INVENTORY_INDUSTRIES}
        required
        searchable={false}
        rules={{ required: 'Industry is required' }}
      />
      <SelectField
        control={control}
        name="category"
        label="Category"
        placeholder={industry ? 'Select category' : 'Select an industry first'}
        options={categoryOptions}
        required
        rules={{ required: 'Category is required' }}
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <FormTextField
            control={control}
            name="quantity"
            label="Quantity *"
            placeholder="0"
            keyboardType="numeric"
            rules={{
              required: 'Quantity is required',
              pattern: { value: NUMERIC, message: 'Numbers only' },
              validate: (v: string) => Number(v) > 0 || 'Must be greater than 0',
            }}
          />
        </View>
        <View style={styles.flex1}>
          <SelectField
            control={control}
            name="unit"
            label="Unit"
            placeholder="pcs"
            options={UNITS}
            required
            rules={{ required: 'Unit is required' }}
            searchable={false}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flex1}>
          <FormTextField
            control={control}
            name="price"
            label="Price per Unit"
            placeholder="0.00"
            keyboardType="numeric"
            rules={{ pattern: { value: NUMERIC, message: 'Numbers only' } }}
          />
        </View>
        <View style={styles.flex1}>
          <SelectField
            control={control}
            name="currency"
            label="Currency"
            placeholder="AED"
            options={CURRENCIES}
            searchable={false}
          />
        </View>
      </View>

      <FormTextField control={control} name="origin" label="Origin" placeholder="e.g. Shenzhen, China" autoCapitalize="words" />
      <FormTextField
        control={control}
        name="stockLocation"
        label="Stock Location"
        placeholder="e.g. Dubai, JAFZA Warehouse 4"
        autoCapitalize="words"
      />
      <FormTextField
        control={control}
        name="description"
        label="Description"
        placeholder="Specs, packaging, MOQ…"
        autoCapitalize="sentences"
        multiline
      />

      {/* Photos */}
      <Text style={styles.sectionLabel}>Photos</Text>
      <View style={styles.thumbs}>
        {(initial?.existingPhotoUrls ?? []).map((url) => (
          <Image key={url} source={{ uri: url }} style={styles.thumb} />
        ))}
        {photos.map((p, i) => (
          <View key={`${p.uri}-${i}`} style={styles.thumbWrap}>
            <Image source={{ uri: p.uri }} style={styles.thumb} />
            <Pressable
              style={styles.removeBadge}
              onPress={() => removePhoto(i)}
              hitSlop={6}
              accessibilityLabel={`Remove photo ${i + 1}`}
            >
              <Text style={styles.removeBadgeText}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addTile} onPress={pickPhotos}>
          <Text style={styles.addTileText}>＋</Text>
        </Pressable>
      </View>

      {/* Documents */}
      <Text style={styles.sectionLabel}>Documents</Text>
      {(initial?.existingDocs ?? []).map((d, i) => (
        <View key={`existing-${i}-${d.name}`} style={styles.docRow}>
          <Text style={styles.docIcon}>📄</Text>
          <Text style={styles.docName} numberOfLines={1}>
            {d.name}
          </Text>
          <Text style={styles.docSaved}>Saved</Text>
        </View>
      ))}
      {docs.map((d, i) => (
        <View key={`${d.uri}-${i}`} style={styles.docRow}>
          <Text style={styles.docIcon}>📄</Text>
          <Text style={styles.docName} numberOfLines={1}>
            {d.name}
          </Text>
          <Pressable onPress={() => removeDoc(i)} hitSlop={8} accessibilityLabel={`Remove ${d.name}`}>
            <Text style={styles.docRemove}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.docAdd} onPress={pickDocs}>
        <Text style={styles.docAddText}>＋ Add document</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <AppButton
        title={submitLabel}
        onPress={submit}
        loading={submitting || isSubmitting}
        disabled={Object.keys(errors).length > 0}
        style={styles.submit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.slate700, marginTop: 8, marginBottom: 10 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  thumbWrap: { width: 72, height: 72 },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.slate100 },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', lineHeight: 13 },
  docRemove: { fontSize: 15, fontWeight: '700', color: colors.slate500, paddingHorizontal: 4 },
  addTile: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileText: { fontSize: 26, color: colors.slate400 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  docIcon: { fontSize: 16 },
  docName: { flex: 1, fontSize: 13, color: colors.slate700 },
  docSaved: { fontSize: 11, fontWeight: '700', color: colors.emerald },
  docAdd: { paddingVertical: 12 },
  docAddText: { color: colors.emerald, fontWeight: '700', fontSize: 13 },
  error: { color: colors.red, fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  submit: { marginTop: 20 },
});
