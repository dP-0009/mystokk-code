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
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { InventoryInput } from '../../services/supabase/inventory';
import { toFullUrl, type UploadFile } from '../../services/supabase/storage';
import { CURRENCIES, UNITS } from '../../constants/inventory';
import { SETTINGS_INDUSTRIES, SETTINGS_INDUSTRY_CATEGORIES } from '../../constants/industries';
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
  industry?: string;
  category?: string;
  price?: string;
  currency?: string;
  origin?: string;
  stockLocation?: string;
  description?: string;
}

/** Saved photos/documents the user removed in this edit session. */
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
  /** Seed values for editing an existing item. Applied on mount. */
  initial?: AddItemFormInitial;
  /** Already-saved photos (url + storage path) — shown above newly-added ones, each removable. */
  existingPhotos?: { url: string; path: string }[];
  /** Already-saved documents (name + storage path) — shown above newly-added ones, each removable. */
  existingDocs?: { name: string; path: string }[];
  /** Pre-loaded photos to UPLOAD (e.g. copied from a received item being edited). */
  initialPhotos?: UploadFile[];
  /** Pre-loaded documents to UPLOAD. */
  initialDocs?: UploadFile[];
  /** Optional banner shown at the very top of the form. */
  warning?: string;
  /** Primary button label. Defaults to "Submit". */
  submitLabel?: string;
  /** When set, renders a second primary button (e.g. "Save & Share") that runs this handler. */
  secondarySubmitLabel?: string;
  onSecondarySubmit?: SubmitHandler;
}

type Errors = Partial<Record<'title' | 'quantity' | 'price', string>>;

const LAST_CURRENCY_KEY = 'mystokk:lastCurrency';

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
  submitLabel = 'Submit',
  secondarySubmitLabel,
  onSecondarySubmit,
}: AddItemFormProps): React.JSX.Element {
  const [productCode, setProductCode] = useState(initial?.productCode ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [quantity, setQuantity] = useState(initial?.quantity ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? 'pcs');
  const [industry, setIndustry] = useState(initial?.industry ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'AED');
  const [origin, setOrigin] = useState(initial?.origin ?? '');
  const [stockLocation, setStockLocation] = useState(initial?.stockLocation ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [photos, setPhotos] = useState<UploadFile[]>(initialPhotos ?? []);
  const [docs, setDocs] = useState<UploadFile[]>(initialDocs ?? []);
  const [errors, setErrors] = useState<Errors>({});
  // Saved attachments the user removed this session (deleted on submit).
  const [removedPhotoPaths, setRemovedPhotoPaths] = useState<string[]>([]);
  const [removedDocPaths, setRemovedDocPaths] = useState<string[]>([]);

  // New item (no seed currency): default to the last currency this user picked
  // (persisted locally), falling back to AED the very first time.
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

  const { open: openLightbox } = useLightbox();
  // Saved photos still present (not removed), normalized to full URLs for the lightbox.
  const visibleExistingPhotos = (existingPhotos ?? []).filter((p) => !removedPhotoPaths.includes(p.path));
  const existingFullUrls = visibleExistingPhotos.map((p) => toFullUrl(p.url)).filter(Boolean);
  const visibleExistingDocs = (existingDocs ?? []).filter((d) => !removedDocPaths.includes(d.path));

  // Category options depend on the chosen industry (same taxonomy as the profile).
  const categoryOptions = industry ? SETTINGS_INDUSTRY_CATEGORIES[industry] ?? [] : [];
  const onIndustryChange = (next: string): void => {
    setIndustry(next);
    // Drop a category that no longer belongs to the newly-selected industry.
    const allowed = SETTINGS_INDUSTRY_CATEGORIES[next] ?? [];
    setCategory((c) => (allowed.includes(c) ? c : ''));
  };

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

  const runSubmit = (handler: SubmitHandler): void => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: InventoryInput = {
      title: title.trim(),
      productCode: productCode.trim() || undefined,
      industry: industry || null,
      category: category || null,
      quantity: Number(quantity),
      unit,
      price: price.trim() ? Number(price) : null,
      currency,
      origin: origin.trim() || undefined,
      stockLocation: stockLocation.trim() || undefined,
      description: description.trim() || undefined,
    };
    // Remember this currency so the next new item defaults to it.
    void AsyncStorage.setItem(LAST_CURRENCY_KEY, currency);
    void handler(input, photos, docs, { photoPaths: removedPhotoPaths, docPaths: removedDocPaths });
  };

  const submit = (): void => runSubmit(onSubmit);

  return (
    <View>
      {warning ? (
        <View style={styles.warningBanner}>
          <Ionicons name="information-circle-outline" size={18} color={colors.amber} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ) : null}

      {/* Single continuous form — no separate section cards. */}
      <View style={styles.card}>
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

        <View style={[styles.row, styles.z60]}>
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

        {/* Optional taxonomy — Industry + Category side by side (same dependency as the profile). */}
        <View style={[styles.row, styles.z55]}>
          <View style={[styles.col, styles.colSelect]}>
            <Field label="Industry (optional)">
              <Select
                value={industry}
                onChange={onIndustryChange}
                options={SETTINGS_INDUSTRIES}
                placeholder="Select industry (optional)"
              />
            </Field>
          </View>
          <View style={[styles.col, styles.colSelect]}>
            <Field label="Category (optional)">
              <Select
                value={category}
                onChange={setCategory}
                options={categoryOptions}
                placeholder={industry ? 'Select category (optional)' : 'Select an industry first'}
                disabled={!industry}
              />
            </Field>
          </View>
        </View>

        <View style={[styles.row, styles.z45]}>
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

        <Field label="Description">
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Specs, packaging, MOQ…"
            autoCapitalize="sentences"
            multiline
          />
        </Field>

        <Field label="Photos">
          <UploadZone
            icon="image-outline"
            title="Click to upload photos"
            hint="PNG or JPG, up to 8 images"
            onPress={pickPhotos}
          />
          {visibleExistingPhotos.length > 0 || photos.length > 0 ? (
            <View style={styles.thumbs}>
              {visibleExistingPhotos.map((p, i) => (
                <View key={p.path} style={styles.thumbWrap}>
                  <Pressable
                    onPress={() => openLightbox(existingFullUrls, i)}
                    style={webOnly({ cursor: 'pointer' })}
                    accessibilityLabel={`View photo ${i + 1}`}
                  >
                    <Image source={{ uri: existingFullUrls[i] }} style={styles.thumb} />
                  </Pressable>
                  <Pressable
                    style={styles.thumbRemove}
                    onPress={() => setRemovedPhotoPaths((prev) => [...prev, p.path])}
                    hitSlop={6}
                    accessibilityLabel={`Remove photo ${i + 1}`}
                  >
                    <Ionicons name="close" size={11} color={colors.bgWhite} />
                  </Pressable>
                </View>
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
        </Field>

        <Field label="Documents">
          <UploadZone
            icon="document-text-outline"
            title="Click to upload documents"
            hint="PDF, Word, Excel, CSV"
            onPress={pickDocs}
          />
          {visibleExistingDocs.map((d) => (
            <View key={`existing-${d.path}`} style={styles.docRow}>
              <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.docName} numberOfLines={1}>
                {d.name}
              </Text>
              <Text style={styles.docSaved}>Saved</Text>
              <Pressable
                onPress={() => setRemovedDocPaths((prev) => [...prev, d.path])}
                hitSlop={8}
                accessibilityLabel={`Remove ${d.name}`}
              >
                <Ionicons name="close" size={16} color={colors.red} />
              </Pressable>
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
        </Field>
      </View>

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
        {onSecondarySubmit ? (
          <Pressable
            style={[styles.btn, styles.btnAccent, submitting ? styles.btnDisabled : null]}
            onPress={() => runSubmit(onSecondarySubmit)}
            disabled={submitting}
          >
            <Ionicons name="share-social-outline" size={15} color={colors.bgWhite} />
            <Text style={styles.btnPrimaryText}>{secondarySubmitLabel ?? 'Save & Share'}</Text>
          </Pressable>
        ) : null}
      </View>
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
  // Single form card holding every field (no separate sections).
  card: {
    position: 'relative',
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg, // 16
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 16,
  },

  // Descending stacking layers so an open dropdown's panel (which extends
  // downward) overlays the fields below it rather than being painted over.
  z60: { position: 'relative', zIndex: 60 },
  z55: { position: 'relative', zIndex: 55 },
  z50: { position: 'relative', zIndex: 50 },
  z45: { position: 'relative', zIndex: 45 },

  // 2-column rows. position:relative + zIndex lift the whole row (and any open
  // select dropdown inside it) above the sibling fields that follow it in the
  // same card — without this the Origin/Stock Location inputs paint over the
  // dropdown. zIndex on colSelect alone can't do this: it only ranks the select
  // within its own row, not against the row's later siblings.
  row: { flexDirection: 'row', gap: 16, position: 'relative', zIndex: 1 },
  col: { flex: 1, minWidth: 0 },
  // Keep the select column above its sibling Price column within the row.
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

  // Warning / info banner at the top of the form.
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: colors.yellowBorder,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  warningText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.amber, lineHeight: 18 },

  // Action bar — right-aligned, gap 12, wraps on narrow widths.
  actionBar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4, flexWrap: 'wrap' },
  btn: { flexDirection: 'row', gap: 6, paddingVertical: 11, paddingHorizontal: 22, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bgWhite },
  btnOutlineText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  btnPrimary: { backgroundColor: colors.primary },
  btnAccent: { backgroundColor: colors.accent },
  btnPrimaryText: { fontSize: 13, fontWeight: '600', color: colors.bgWhite },
  btnDisabled: { opacity: 0.6 },
});
