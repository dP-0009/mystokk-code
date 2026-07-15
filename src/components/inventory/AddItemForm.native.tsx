import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { InventoryInput } from '../../services/supabase/inventory';
import { toFullUrl, type UploadFile } from '../../services/supabase/storage';
import { CURRENCIES, UNITS } from '../../constants/inventory';
import { SETTINGS_INDUSTRIES, SETTINGS_INDUSTRY_CATEGORIES } from '../../constants/industries';
import {
  Button,
  CategoryChip,
  CategoryChipGroup,
  GlassPanel,
  Icon,
  PickerSheet,
  QtyStepper,
  Select,
  Sheet,
  SheetAction,
  TextArea,
  TextField,
  colors,
  glass,
  radii,
  spacing,
} from '../mobile';

/* MIME resolution — office files often report octet-stream, which the bucket
 * rejects; resolve from the extension. (Same table as the web form.) */
const DOC_MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};
const ALLOWED_DOC_MIMES = new Set(Object.values(DOC_MIME_BY_EXT));
function resolveDocMime(reported: string | undefined, name: string): string {
  if (reported && ALLOWED_DOC_MIMES.has(reported)) return reported;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return DOC_MIME_BY_EXT[ext] ?? reported ?? 'application/pdf';
}

const NUMERIC = /^\d*\.?\d*$/;
const LAST_CURRENCY_KEY = 'mystokk:lastCurrency';

/** Prefill values (all strings) — matches the web AddItemForm contract. */
export interface AddItemFormInitial {
  productCode?: string;
  title?: string;
  quantity?: string;
  unit?: string;
  industry?: string;
  category?: string;
  price?: string;
  currency?: string;
  origin?: string;
  stockLocation?: string;
  description?: string;
}

export interface RemovedAttachments {
  photoPaths: string[];
  docPaths: string[];
}

type SubmitHandler = (
  input: InventoryInput,
  photos: UploadFile[],
  docs: UploadFile[],
  removed: RemovedAttachments,
) => void | Promise<void>;

interface AddItemFormProps {
  submitting: boolean;
  error?: string | null;
  onSubmit: SubmitHandler;
  onCancel: () => void;
  initial?: AddItemFormInitial;
  existingPhotos?: { url: string; path: string }[];
  existingDocs?: { name: string; path: string }[];
  initialPhotos?: UploadFile[];
  initialDocs?: UploadFile[];
  warning?: string;
  submitLabel?: string;
  secondarySubmitLabel?: string;
  onSecondarySubmit?: SubmitHandler;
}

type Errors = Partial<Record<'title' | 'quantity' | 'price', string>>;
type PickerId = 'industry' | 'unit' | 'currency' | null;

/**
 * Native item form (prototype SCREENS.editItem) — ONE form for Add and Edit, in
 * the prototype's field order. Same props contract and submit signature as the
 * web AddItemForm, and the SAME expo pickers + upload payload shape, so the
 * screen forks reuse the existing create/update + upload logic unchanged.
 */
export function AddItemForm({
  submitting,
  error,
  onSubmit,
  onCancel,
  initial,
  existingPhotos,
  existingDocs,
  initialPhotos,
  initialDocs,
  warning,
  submitLabel = 'Save item',
  secondarySubmitLabel,
  onSecondarySubmit,
}: AddItemFormProps): React.JSX.Element {
  const [productCode, setProductCode] = React.useState(initial?.productCode ?? '');
  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [industry, setIndustry] = React.useState(initial?.industry ?? '');
  // Multi-select categories, stored as a comma-joined string in the single
  // `category` column (no schema change).
  const [categories, setCategories] = React.useState<string[]>(
    initial?.category ? initial.category.split(',').map((s) => s.trim()).filter(Boolean) : [],
  );
  const [quantity, setQuantity] = React.useState(() => Number(initial?.quantity ?? '') || 0);
  const [unit, setUnit] = React.useState(initial?.unit ?? 'pcs');
  const [price, setPrice] = React.useState(initial?.price ?? '');
  const [currency, setCurrency] = React.useState(initial?.currency ?? 'AED');
  const [stockLocation, setStockLocation] = React.useState(initial?.stockLocation ?? '');
  const [origin, setOrigin] = React.useState(initial?.origin ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [photos, setPhotos] = React.useState<UploadFile[]>(initialPhotos ?? []);
  const [docs, setDocs] = React.useState<UploadFile[]>(initialDocs ?? []);
  const [errors, setErrors] = React.useState<Errors>({});
  const [removedPhotoPaths, setRemovedPhotoPaths] = React.useState<string[]>([]);
  const [removedDocPaths, setRemovedDocPaths] = React.useState<string[]>([]);
  const [picker, setPicker] = React.useState<PickerId>(null);
  const [photoMenu, setPhotoMenu] = React.useState(false);

  const isEditing = initial?.currency !== undefined;
  React.useEffect(() => {
    if (isEditing) return;
    let active = true;
    void AsyncStorage.getItem(LAST_CURRENCY_KEY).then((v) => {
      if (active && v) setCurrency(v);
    });
    return () => {
      active = false;
    };
  }, [isEditing]);

  const categoryOptions = industry ? SETTINGS_INDUSTRY_CATEGORIES[industry] ?? [] : [];
  const onIndustryChange = (next: string): void => {
    setIndustry(next);
    const allowed = SETTINGS_INDUSTRY_CATEGORIES[next] ?? [];
    setCategories((cur) => cur.filter((c) => allowed.includes(c)));
  };
  const toggleCategory = (c: string): void =>
    setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const visiblePhotos = (existingPhotos ?? []).filter((p) => !removedPhotoPaths.includes(p.path));
  const visibleDocs = (existingDocs ?? []).filter((d) => !removedDocPaths.includes(d.path));

  const addAssets = (assets: ImagePicker.ImagePickerAsset[]): void => {
    setPhotos((prev) => [
      ...prev,
      ...assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `photo-${Date.now()}.jpg`,
        mimeType: a.mimeType ?? 'image/jpeg',
      })),
    ]);
  };

  /** Camera — take a photo and upload it immediately. */
  const pickCamera = async (): Promise<void> => {
    setPhotoMenu(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled) addAssets(res.assets);
  };

  /** Photos — pick from the photo library. */
  const pickLibrary = async (): Promise<void> => {
    setPhotoMenu(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (!res.canceled) addAssets(res.assets);
  };

  /** Files — pick image files from the file system. */
  const pickImageFiles = async (): Promise<void> => {
    setPhotoMenu(false);
    const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return;
    setPhotos((prev) => [
      ...prev,
      ...res.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'image/jpeg' })),
    ]);
  };

  const pickDocs = async (): Promise<void> => {
    const res = await DocumentPicker.getDocumentAsync({
      type: Array.from(ALLOWED_DOC_MIMES),
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    setDocs((prev) => [
      ...prev,
      ...res.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        mimeType: resolveDocMime(a.mimeType, a.name),
        size: a.size ?? undefined,
      })),
    ]);
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!title.trim()) next.title = 'Title is required';
    if (quantity <= 0) next.quantity = 'Enter a quantity greater than 0';
    if (price.trim() && !NUMERIC.test(price)) next.price = 'Numbers only';
    return next;
  };

  const runSubmit = (handler: SubmitHandler): void => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: InventoryInput = {
      title: title.trim(),
      productCode: productCode.trim() || undefined,
      industry: industry || null,
      category: categories.length ? categories.join(', ') : null,
      quantity,
      unit,
      price: price.trim() ? Number(price) : null,
      currency,
      origin: origin.trim() || undefined,
      stockLocation: stockLocation.trim() || undefined,
      description: description.trim() || undefined,
    };
    void AsyncStorage.setItem(LAST_CURRENCY_KEY, currency);
    void handler(input, photos, docs, { photoPaths: removedPhotoPaths, docPaths: removedDocPaths });
  };

  return (
    <View>
      {warning ? (
        <View style={styles.warning}>
          <Icon name="shield" size={20} color={colors.amber} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ) : null}

      <TextField
        label="Product code"
        value={productCode}
        onChangeText={setProductCode}
        placeholder="e.g., SKU-001 (auto if blank)"
        autoCapitalize="characters"
      />
      <TextField
        label="Title"
        required
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
        }}
        placeholder="e.g., Premium Cotton Fabric"
        error={errors.title}
        autoCapitalize="sentences"
      />

      <Select label="Industry" placeholder="Select industry (optional)" value={industry || undefined} onPress={() => setPicker('industry')} />

      {/* Categories — glass multi-select chips, filtered to the chosen industry. */}
      {industry ? (
        <View style={styles.catsBlock}>
          <Text style={styles.label}>Categories</Text>
          {categoryOptions.length === 0 ? (
            <Text style={styles.catsHint}>No categories for this industry.</Text>
          ) : (
            <CategoryChipGroup>
              {categoryOptions.map((c) => (
                <CategoryChip key={c} label={c} selected={categories.includes(c)} onPress={() => toggleCategory(c)} />
              ))}
            </CategoryChipGroup>
          )}
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.colWide}>
          <Text style={styles.label}>Quantity *</Text>
          <QtyStepper value={quantity} onChange={(n) => {
            setQuantity(n);
            if (errors.quantity) setErrors((e) => ({ ...e, quantity: undefined }));
          }} step={10} />
          {errors.quantity ? <Text style={styles.err}>{errors.quantity}</Text> : null}
        </View>
        <View style={styles.col}>
          <Select label="Unit" required value={unit} onPress={() => setPicker('unit')} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.colWide}>
          <TextField
            label="Price per unit"
            value={price}
            onChangeText={(v) => {
              setPrice(v);
              if (errors.price) setErrors((e) => ({ ...e, price: undefined }));
            }}
            placeholder="Leave blank — on request"
            error={errors.price}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.col}>
          <Select label="Currency" value={currency} onPress={() => setPicker('currency')} />
        </View>
      </View>

      <TextField label="Stock location" value={stockLocation} onChangeText={setStockLocation} placeholder="e.g., Dubai, JAFZA Warehouse 4" autoCapitalize="words" />
      <TextField label="Origin" value={origin} onChangeText={setOrigin} placeholder="e.g., Shenzhen, China" autoCapitalize="words" />
      <TextArea label="Description" value={description} onChangeText={setDescription} placeholder="Specs, packaging, MOQ…" autoCapitalize="sentences" />

      {/* Photos */}
      <Text style={styles.section}>PHOTOS</Text>
      <Pressable onPress={() => setPhotoMenu(true)}>
        <View style={styles.upload}>
          <Icon name="camera" size={26} color={colors.blue} />
          <Text style={styles.uploadTitle}>Add photos</Text>
          <Text style={styles.uploadHint}>Camera, Photos, or Files</Text>
        </View>
      </Pressable>
      {visiblePhotos.length > 0 || photos.length > 0 ? (
        <View style={styles.thumbs}>
          {visiblePhotos.map((p) => (
            <View key={p.path} style={styles.thumbWrap}>
              <Image source={{ uri: toFullUrl(p.url) }} style={styles.thumb} />
              <Pressable style={styles.thumbX} onPress={() => setRemovedPhotoPaths((prev) => [...prev, p.path])} hitSlop={6}>
                <Text style={styles.thumbXText}>×</Text>
              </Pressable>
            </View>
          ))}
          {photos.map((p, i) => (
            <View key={`${p.uri}-${i}`} style={styles.thumbWrap}>
              <Image source={{ uri: p.uri }} style={styles.thumb} />
              <Pressable style={styles.thumbX} onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} hitSlop={6}>
                <Text style={styles.thumbXText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* Documents */}
      <Text style={styles.section}>DOCUMENTS</Text>
      <Pressable onPress={() => void pickDocs()}>
        <View style={[styles.upload, styles.uploadDoc]}>
          <Icon name="doc" size={24} color={colors.muted} />
          <Text style={styles.uploadTitleDark}>Click to upload documents</Text>
          <Text style={styles.uploadHint}>PDF, Word, Excel, CSV</Text>
        </View>
      </Pressable>
      {visibleDocs.map((d) => (
        <GlassPanel key={`ex-${d.path}`} effect="clear" radius={radii.doc} style={styles.docRow}>
          <Icon name="doc" size={20} color={colors.green} />
          <Text style={styles.docName} numberOfLines={1}>{d.name}</Text>
          <Text style={styles.docSaved}>Saved</Text>
          <Pressable onPress={() => setRemovedDocPaths((prev) => [...prev, d.path])} hitSlop={8}>
            <Text style={styles.docX}>×</Text>
          </Pressable>
        </GlassPanel>
      ))}
      {docs.map((d, i) => (
        <GlassPanel key={`${d.uri}-${i}`} effect="clear" radius={radii.doc} style={styles.docRow}>
          <Icon name="doc" size={20} color={colors.blueDark} />
          <Text style={styles.docName} numberOfLines={1}>{d.name}</Text>
          <Pressable onPress={() => setDocs((prev) => prev.filter((_, j) => j !== i))} hitSlop={8}>
            <Text style={styles.docX}>×</Text>
          </Pressable>
        </GlassPanel>
      ))}

      {error ? <Text style={styles.formError}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={submitting} style={styles.cancelBtn} />
        <Button
          label={submitting ? 'Saving…' : submitLabel}
          variant="primary"
          onPress={() => runSubmit(onSubmit)}
          disabled={submitting}
          style={styles.saveBtn}
        />
      </View>
      {onSecondarySubmit ? (
        <Button
          label={secondarySubmitLabel ?? 'Save & Share'}
          variant="dark"
          icon={<Icon name="share" size={18} color="#FFFFFF" />}
          onPress={() => runSubmit(onSecondarySubmit)}
          disabled={submitting}
          style={styles.secondaryBtn}
        />
      ) : null}

      <PickerSheet open={picker === 'industry'} onClose={() => setPicker(null)} title="Industry" options={SETTINGS_INDUSTRIES} value={industry} onSelect={onIndustryChange} />
      <PickerSheet open={picker === 'unit'} onClose={() => setPicker(null)} title="Unit" options={UNITS} value={unit} onSelect={setUnit} />
      <PickerSheet open={picker === 'currency'} onClose={() => setPicker(null)} title="Currency" options={CURRENCIES} value={currency} onSelect={setCurrency} />

      {/* Photo source chooser: Camera / Photos / Files. */}
      <Sheet open={photoMenu} onClose={() => setPhotoMenu(false)} title="Add photos">
        <SheetAction icon="camera" label="Take photo" onPress={() => void pickCamera()} />
        <SheetAction icon="eye" label="Choose from Photos" onPress={() => void pickLibrary()} />
        <SheetAction icon="doc" label="Choose from Files" last onPress={() => void pickImageFiles()} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,205,110,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(240,224,188,0.9)',
    borderRadius: 14,
    padding: 13,
    marginBottom: 16,
  },
  warningText: { flex: 1, fontSize: 13, color: '#6B5518', lineHeight: 19.5 },

  row: { flexDirection: 'row', gap: 11 },
  col: { flex: 1 },
  colWide: { flex: 1.2 },
  label: { fontSize: 13, fontWeight: '800', color: colors.navy },
  err: { color: colors.red, fontSize: 12.5, fontWeight: '700', marginTop: 6 },
  catsBlock: { marginBottom: 14 },
  catsHint: { fontSize: 12.5, color: colors.muted, marginTop: 6 },

  section: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.7, color: colors.muted, marginTop: 22, marginBottom: 10 },
  upload: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 112,
    borderWidth: 2,
    borderColor: colors.dashed,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: 'rgba(243,248,255,0.9)',
  },
  uploadDoc: { borderColor: '#D5DDEB', backgroundColor: 'rgba(247,249,253,0.9)' },
  uploadTitle: { fontSize: 13, fontWeight: '800', color: colors.blue },
  uploadTitleDark: { fontSize: 13, fontWeight: '800', color: colors.navy },
  uploadHint: { fontSize: 11.5, color: colors.muted, fontWeight: '600' },

  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  thumbWrap: { width: 78, height: 78 },
  thumb: { width: 78, height: 78, borderRadius: 14, backgroundColor: colors.grayBg },
  thumbX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbXText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 9 },
  docName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.navy },
  docSaved: { fontSize: 12, fontWeight: '800', color: colors.green },
  docX: { color: colors.muted, fontWeight: '800', fontSize: 16 },

  formError: { color: colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 14 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1 },
  saveBtn: { flex: 1.6 },
  secondaryBtn: { marginTop: 10 },
});
