import React, { useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import type { InventoryInput } from '../../services/supabase/inventory';
import { toFullUrl, type UploadFile } from '../../services/supabase/storage';
import { CURRENCIES, UNITS } from '../../constants/inventory';
import { colors, radius, shadows } from '../../theme/tokens';
import { webOnly } from '../layout/web';
import { useLightbox } from '../shared/Lightbox';

/* ------------------------------------------------------------------ *
 * Document MIME resolution — the OS/browser often reports
 * `application/octet-stream` for office files, which the bucket rejects.
 * Resolve a real content type from the file extension.
 * ------------------------------------------------------------------ */
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

/** Human-readable file size, e.g. "820 KB" / "1.4 MB". Empty when unknown. */
function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Pre-populated field values (all strings — the form edits text). */
export interface AddItemFormInitial {
  productCode?: string;
  title?: string;
  quantity?: string;
  unit?: string;
  price?: string;
  currency?: string;
  origin?: string;
  stockLocation?: string;
  description?: string;
}

interface AddItemFormProps {
  submitting: boolean;
  error?: string | null;
  onSubmit: (input: InventoryInput, photos: UploadFile[], docs: UploadFile[]) => void | Promise<void>;
  onCancel: () => void;
  /** Seed values for editing an existing item. Applied on mount. */
  initial?: AddItemFormInitial;
  /** Already-saved photo URLs — shown read-only above newly-added ones. */
  existingPhotoUrls?: string[];
  /** Already-saved documents — shown read-only above newly-added ones. */
  existingDocs?: { name: string }[];
  /** Primary button label. Defaults to "Submit". */
  submitLabel?: string;
}

type Errors = Partial<Record<'title' | 'quantity' | 'price', string>>;

export function AddItemForm({
  submitting,
  error,
  onSubmit,
  onCancel,
  initial,
  existingPhotoUrls,
  existingDocs,
  submitLabel = 'Submit',
}: AddItemFormProps): React.JSX.Element {
  const [productCode, setProductCode] = useState(initial?.productCode ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [quantity, setQuantity] = useState(initial?.quantity ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? 'pcs');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'AED');
  const [origin, setOrigin] = useState(initial?.origin ?? '');
  const [stockLocation, setStockLocation] = useState(initial?.stockLocation ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [photos, setPhotos] = useState<UploadFile[]>([]);
  const [docs, setDocs] = useState<UploadFile[]>([]);
  const [errors, setErrors] = useState<Errors>({});

  const { open: openLightbox } = useLightbox();
  // Already-saved photos, normalized to full URLs for the shared lightbox.
  const existingFullUrls = (existingPhotoUrls ?? []).map(toFullUrl).filter(Boolean);

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
    // Only accept PDF / Word / Excel / CSV documents (the bucket's allowed types).
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

  const removePhoto = (index: number): void => setPhotos((prev) => prev.filter((_, i) => i !== index));
  const removeDoc = (index: number): void => setDocs((prev) => prev.filter((_, i) => i !== index));

  const validate = (): Errors => {
    const next: Errors = {};
    if (!title.trim()) next.title = 'Title is required';
    if (!quantity.trim()) next.quantity = 'Quantity is required';
    else if (!NUMERIC.test(quantity) || Number(quantity) <= 0) next.quantity = 'Enter a quantity greater than 0';
    if (price.trim() && !NUMERIC.test(price)) next.price = 'Numbers only';
    return next;
  };

  const submit = (): void => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: InventoryInput = {
      title: title.trim(),
      productCode: productCode.trim() || undefined,
      quantity: Number(quantity),
      unit,
      price: price.trim() ? Number(price) : null,
      currency,
      origin: origin.trim() || undefined,
      stockLocation: stockLocation.trim() || undefined,
      description: description.trim() || undefined,
    };
    void onSubmit(input, photos, docs);
  };

  return (
    <View>
      {/* SECTION 1 — Basic Information */}
      <SectionCard title="Basic Information" z={50}>
        <Field label="Product Code">
          <Input value={productCode} onChangeText={setProductCode} placeholder="e.g., SKU-001" autoCapitalize="characters" />
        </Field>

        <Field label="Title" required error={errors.title}>
          <Input
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
            }}
            placeholder="e.g., Premium Cotton Fabric"
            invalid={!!errors.title}
            autoCapitalize="sentences"
          />
        </Field>

        <View style={styles.row}>
          <View style={styles.col}>
            <Field label="Quantity" required error={errors.quantity}>
              <Input
                value={quantity}
                onChangeText={(v) => {
                  setQuantity(v);
                  if (errors.quantity) setErrors((e) => ({ ...e, quantity: undefined }));
                }}
                placeholder="100"
                keyboardType="numeric"
                invalid={!!errors.quantity}
              />
            </Field>
          </View>
          <View style={[styles.col, styles.colSelect]}>
            <Field label="Unit" required>
              <Select value={unit} onChange={setUnit} options={UNITS} placeholder="Select unit" />
            </Field>
          </View>
        </View>
      </SectionCard>

      {/* SECTION 2 — Pricing & Sourcing */}
      <SectionCard title="Pricing & Sourcing" z={40}>
        <View style={styles.row}>
          <View style={styles.col}>
            <Field label="Price per Unit" error={errors.price}>
              <Input
                value={price}
                onChangeText={(v) => {
                  setPrice(v);
                  if (errors.price) setErrors((e) => ({ ...e, price: undefined }));
                }}
                placeholder="0.00"
                keyboardType="numeric"
                invalid={!!errors.price}
              />
            </Field>
          </View>
          <View style={[styles.col, styles.colSelect]}>
            <Field label="Currency">
              <Select value={currency} onChange={setCurrency} options={CURRENCIES} placeholder="Currency" />
            </Field>
          </View>
        </View>

        <Field label="Origin">
          <Input value={origin} onChangeText={setOrigin} placeholder="e.g., Shenzhen, China" autoCapitalize="words" />
        </Field>
        <Field label="Stock Location">
          <Input
            value={stockLocation}
            onChangeText={setStockLocation}
            placeholder="e.g., Dubai, JAFZA Warehouse 4"
            autoCapitalize="words"
          />
        </Field>
      </SectionCard>

      {/* SECTION 3 — Description */}
      <SectionCard title="Description">
        <Field label="Description">
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Specs, packaging, MOQ…"
            autoCapitalize="sentences"
            multiline
          />
        </Field>
      </SectionCard>

      {/* SECTION 4 — Photos */}
      <SectionCard title="Photos">
        <UploadZone
          icon="image-outline"
          title="Click to upload photos"
          hint="PNG or JPG, up to 8 images"
          onPress={pickPhotos}
        />
        {existingFullUrls.length > 0 || photos.length > 0 ? (
          <View style={styles.thumbs}>
            {existingFullUrls.map((url, i) => (
              <Pressable
                key={url}
                onPress={() => openLightbox(existingFullUrls, i)}
                style={webOnly({ cursor: 'pointer' })}
                accessibilityLabel={`View photo ${i + 1}`}
              >
                <Image source={{ uri: url }} style={styles.thumb} />
              </Pressable>
            ))}
            {photos.map((p, i) => (
              <View key={`${p.uri}-${i}`} style={styles.thumbWrap}>
                <Image source={{ uri: p.uri }} style={styles.thumb} />
                <Pressable
                  style={styles.thumbRemove}
                  onPress={() => removePhoto(i)}
                  hitSlop={6}
                  accessibilityLabel={`Remove photo ${i + 1}`}
                >
                  <Ionicons name="close" size={11} color={colors.bgWhite} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </SectionCard>

      {/* SECTION 5 — Documents */}
      <SectionCard title="Documents">
        <UploadZone
          icon="document-text-outline"
          title="Click to upload documents"
          hint="PDF, Word, Excel, CSV"
          onPress={pickDocs}
        />
        {(existingDocs ?? []).map((d, i) => (
          <View key={`existing-${i}-${d.name}`} style={styles.docRow}>
            <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.docName} numberOfLines={1}>
              {d.name}
            </Text>
            <Text style={styles.docSaved}>Saved</Text>
          </View>
        ))}
        {docs.map((d, i) => (
          <View key={`${d.uri}-${i}`} style={styles.docRow}>
            <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.docName} numberOfLines={1}>
              {d.name}
            </Text>
            {formatSize(d.size) ? <Text style={styles.docSize}>{formatSize(d.size)}</Text> : null}
            <Pressable onPress={() => removeDoc(i)} hitSlop={8} accessibilityLabel={`Remove ${d.name}`}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </SectionCard>

      {error ? <Text style={styles.formError}>{error}</Text> : null}

      {/* ACTION BAR */}
      <View style={styles.actionBar}>
        <Pressable style={[styles.btn, styles.btnOutline]} onPress={onCancel} disabled={submitting}>
          <Text style={styles.btnOutlineText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnPrimary, submitting ? styles.btnDisabled : null]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.btnPrimaryText}>{submitting ? 'Saving…' : submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Section card — mirror `.section`
 * ------------------------------------------------------------------ */
function SectionCard({
  title,
  children,
  z,
}: {
  title: string;
  children: ReactNode;
  /** Stacking order — earlier cards get a higher value so their select
   *  dropdowns overlay the cards below them rather than being painted over. */
  z?: number;
}): React.JSX.Element {
  return (
    <View style={[styles.card, z !== undefined ? { zIndex: z } : null]}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Labeled field wrapper — uppercase label + required asterisk + error
 * ------------------------------------------------------------------ */
function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Text input — spec styling, blue focus border, no native outline
 * ------------------------------------------------------------------ */
function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  invalid,
  autoCapitalize,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  invalid?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[
        styles.input,
        multiline ? styles.inputMultiline : null,
        invalid ? styles.inputInvalid : null,
        focused ? styles.inputFocused : null,
      ]}
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType={keyboardType}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Select — input-styled trigger that opens an inline dropdown
 * ------------------------------------------------------------------ */
function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.selectWrap}>
      <Pressable
        style={[styles.input, styles.selectTrigger, invalid ? styles.inputInvalid : null, open ? styles.inputFocused : null]}
        onPress={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <Text style={value ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <>
          {/* Invisible full-screen catcher so a click anywhere else closes the menu. */}
          <Pressable style={styles.outside} onPress={() => setOpen(false)} />
          <View style={styles.dropdown}>
            {options.length === 0 ? (
              <View style={styles.option}>
                <Text style={styles.selectPlaceholder}>No options</Text>
              </View>
            ) : (
              <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {options.map((opt) => (
                  <SelectOption
                    key={opt}
                    label={opt}
                    active={opt === value}
                    onPress={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** One option row in the Select dropdown — highlights on hover (web). */
function SelectOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      style={[styles.option, hovered ? styles.optionHover : null, active ? styles.optionActive : null]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>{label}</Text>
      {active ? <Ionicons name="checkmark" size={15} color={colors.accent} /> : null}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 * Dashed upload zone
 * ------------------------------------------------------------------ */
function UploadZone({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable style={styles.upload} onPress={onPress}>
      <Ionicons name={icon} size={26} color={colors.textMuted} />
      <Text style={styles.uploadTitle}>{title}</Text>
      <Text style={styles.uploadHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Section card — mirror `.section`
  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg, // 16
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: colors.textPrimary,
    paddingBottom: 14,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // 2-column rows
  row: { flexDirection: 'row', gap: 16 },
  col: { flex: 1, minWidth: 0 },
  // Selects need a higher zIndex so their dropdown layers over later fields.
  colSelect: { zIndex: 20 },

  // Field + label — mirror `.field label`
  field: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  required: { color: colors.red },
  fieldError: { fontSize: 11, fontWeight: '600', color: colors.red, marginTop: 4 },

  // Input — mirror `.field input`
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md, // 10
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.bgWhite,
    // Suppress react-native-web's default focus outline (we draw a blue border
    // instead). `outlineStyle` is a web-only style key not in RN's TextStyle.
    ...({ outlineStyle: 'none' } as unknown as TextStyle),
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: 10 },
  inputFocused: { borderColor: colors.accent },
  inputInvalid: { borderColor: colors.red },

  // Select trigger + its anchored, floating dropdown.
  selectWrap: { position: 'relative', zIndex: 1000 },
  selectTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { fontSize: 13, color: colors.textPrimary, flexShrink: 1 },
  selectPlaceholder: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  // Full-screen transparent catcher behind the open panel (outside-click close).
  outside: {
    position: 'absolute',
    top: -2000,
    bottom: -2000,
    left: -2000,
    right: -2000,
    zIndex: 9998,
    ...webOnly({ cursor: 'default' }),
  },
  // Floating panel — clean rounded card like the context menu (screenshot d):
  // soft shadow, hairline border, clipped corners, no always-on scrollbars.
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border, // #E2E8F0
    borderRadius: 14,
    paddingVertical: 6,
    overflow: 'hidden', // clip option rows to the rounded corners
    zIndex: 9999,
    ...shadows.dropdown,
  },
  // The scroll lives inside the clipped panel — vertical only, appears only when
  // the list is taller than 240px (no horizontal scrollbar, no arrow buttons).
  dropdownScroll: { maxHeight: 240 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  optionHover: { backgroundColor: colors.bgChip }, // #F1F5F9
  optionActive: { backgroundColor: colors.accentLight }, // #EFF6FF
  optionText: { fontSize: 13, color: colors.textSecondary },
  optionTextActive: { color: colors.accent, fontWeight: '600' },

  // Upload zone
  upload: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 26,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    backgroundColor: colors.bgPage,
  },
  uploadTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 4 },
  uploadHint: { fontSize: 12, color: colors.textMuted },

  // Photo thumbnails — 72x72, border-radius 8, object-fit cover
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  thumbWrap: { width: 72, height: 72 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.bgChip },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.red, // #DC2626
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },

  // Document list rows
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgPage,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  docName: { flex: 1, fontSize: 13, color: colors.textPrimary },
  docSize: { fontSize: 12, color: colors.textMuted, flexShrink: 0 },
  docSaved: { fontSize: 12, fontWeight: '700', color: colors.green, flexShrink: 0 },

  formError: { color: colors.red, fontSize: 13, fontWeight: '600', marginBottom: 12, textAlign: 'center' },

  // Action bar — right-aligned, gap 12
  actionBar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  btn: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgWhite },
  btnOutlineText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: 13, fontWeight: '600', color: colors.bgWhite },
  btnDisabled: { opacity: 0.6 },
});
