import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { addManualVendor } from '../../services/supabase/network';
import { COUNTRIES, INDUSTRIES } from '../../constants/industries';
import { webOnly } from '../layout/web';
import { colors, radius, shadows } from '../../theme/tokens';
import { toast } from '../../stores/toast';

interface AddVendorModalProps {
  visible: boolean;
  onClose: () => void;
  /** Fired after a vendor is successfully added/connected (queries are already invalidated). */
  onAdded?: () => void;
}

/** Dial codes for the Tel / Mobile country-code selects (mirror `.fse`). */
const DIAL_CODES = ['+971', '+1', '+91', '+44', '+86', '+966', '+974', '+965', '+973', '+968', '+92', '+880', '+65', '+60', '+90', '+20'] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  companyName: string;
  contactPerson: string;
  email: string;
  industry: string;
  telCode: string;
  telNumber: string;
  mobileCode: string;
  mobileNumber: string;
  city: string;
  country: string;
  address: string;
  description: string;
}

const EMPTY: FormState = {
  companyName: '',
  contactPerson: '',
  email: '',
  industry: '',
  telCode: '+1',
  telNumber: '',
  mobileCode: '+971',
  mobileNumber: '',
  city: '',
  country: '',
  address: '',
  description: '',
};

export function AddVendorModal({ visible, onClose, onAdded }: AddVendorModalProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]): void =>
      setForm((f) => ({ ...f, [key]: value }));

  const hasEmail = form.email.trim().length > 0;
  const hasMobile = form.mobileNumber.trim().length > 0;
  const emailOk = !hasEmail || EMAIL_RE.test(form.email.trim());
  const canSubmit = emailOk && (hasEmail || hasMobile);

  const reset = (): void => {
    setForm(EMPTY);
    setError(null);
  };

  const close = (): void => {
    reset();
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () =>
      addManualVendor({
        companyName: form.companyName,
        contactPerson: form.contactPerson,
        email: form.email.trim(),
        mobileNumber: hasMobile ? `${form.mobileCode} ${form.mobileNumber.trim()}` : undefined,
        industry: form.industry || undefined,
        country: form.country || undefined,
        city: form.city || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['network'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Vendor added to your network!');
      onAdded?.();
      close();
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : 'Could not add vendor.';
      setError(message);
      toast.error(message);
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Vendor</Text>
            <Pressable style={styles.close} onPress={close} hitSlop={8} testID="add-vendor-close">
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.note}>
              Add vendor details. <Text style={styles.noteStrong}>Email or Mobile number is required.</Text> All
              other fields are optional.
            </Text>

            <Field label="Company Name">
              <TextInput
                style={styles.input}
                value={form.companyName}
                onChangeText={set('companyName')}
                placeholder="Company Ltd."
                placeholderTextColor={colors.textMuted}
                autoFocus
                testID="add-vendor-company"
              />
            </Field>

            <Field label="Contact Person">
              <TextInput
                style={styles.input}
                value={form.contactPerson}
                onChangeText={set('contactPerson')}
                placeholder="John Smith"
                placeholderTextColor={colors.textMuted}
              />
            </Field>

            <Field label="Email" required>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={set('email')}
                placeholder="contact@company.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="add-vendor-email"
              />
              {hasEmail && !emailOk ? <Text style={styles.fieldErr}>Enter a valid email.</Text> : null}
            </Field>

            <Field label="Industry">
              <SelectBox value={form.industry} placeholder="Select industry" options={INDUSTRIES} onChange={set('industry')} />
            </Field>

            {/* Tel */}
            <View style={styles.fieldRow}>
              <Field label="Code (Tel)" style={styles.codeCol}>
                <SelectBox value={form.telCode} options={DIAL_CODES} onChange={set('telCode')} compact />
              </Field>
              <Field label="Tel Number" style={styles.flex1}>
                <TextInput
                  style={styles.input}
                  value={form.telNumber}
                  onChangeText={set('telNumber')}
                  placeholder="1234567890"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                />
              </Field>
            </View>

            {/* Mobile */}
            <View style={styles.fieldRow}>
              <Field label="Code (Mobile)" style={styles.codeCol}>
                <SelectBox value={form.mobileCode} options={DIAL_CODES} onChange={set('mobileCode')} compact />
              </Field>
              <Field label="Mobile" required style={styles.flex1}>
                <TextInput
                  style={styles.input}
                  value={form.mobileNumber}
                  onChangeText={set('mobileNumber')}
                  placeholder="9876543210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  testID="add-vendor-mobile"
                />
              </Field>
            </View>

            {/* City / Country */}
            <View style={styles.fieldRow}>
              <Field label="City" style={styles.flex1}>
                <TextInput
                  style={styles.input}
                  value={form.city}
                  onChangeText={set('city')}
                  placeholder="New York"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
              </Field>
              <Field label="Country" style={styles.flex1}>
                <SelectBox value={form.country} placeholder="USA" options={COUNTRIES} onChange={set('country')} />
              </Field>
            </View>

            <Field label="Address">
              <TextInput
                style={styles.input}
                value={form.address}
                onChangeText={set('address')}
                placeholder="123 Business Street"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </Field>

            <Field label="Description / Notes">
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.description}
                onChangeText={set('description')}
                placeholder="Additional notes about this vendor..."
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.btnOutline} onPress={close} testID="add-vendor-cancel">
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btnDark, !canSubmit || mutation.isPending ? styles.btnDisabled : null]}
              disabled={!canSubmit || mutation.isPending}
              onPress={() => mutation.mutate()}
              testID="add-vendor-submit"
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnDarkText}>Add Vendor</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A labelled form group (`.fg` + `.fl`), with an optional red required asterisk. */
function Field({
  label,
  required = false,
  style,
  children,
}: {
  label: string;
  required?: boolean;
  style?: object;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

/** Lightweight select (`.fse`) — opens a nested option list modal. */
function SelectBox({
  value,
  placeholder,
  options,
  onChange,
  compact = false,
}: {
  value: string;
  placeholder?: string;
  options: readonly string[];
  onChange: (v: string) => void;
  compact?: boolean;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable style={styles.select} onPress={() => setOpen(true)}>
        <Text style={value ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.optionOverlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.optionCard, compact ? styles.optionCardCompact : null]} onPress={(e) => e.stopPropagation()}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.map((o) => (
                <Pressable
                  key={o}
                  style={styles.option}
                  onPress={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, o === value ? styles.optionSelected : null]}>{o}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // `.mo`
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // `.md`
  card: {
    backgroundColor: colors.bgWhite,
    borderRadius: radius.xl,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    overflow: 'hidden',
    ...shadows.lg,
    ...webOnly({ maxHeight: '90vh' }),
  },

  // `.mh`
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgChip,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  closeText: { fontSize: 16, color: colors.textSecondary },

  // `.mb`
  body: { flexShrink: 1 },
  bodyContent: { paddingHorizontal: 24, paddingVertical: 20 },
  note: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 16 },
  noteStrong: { color: colors.red, fontWeight: '600' },

  // `.fg` / `.fl` / `.fi`
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
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.bgWhite,
  },
  textarea: { minHeight: 80, ...webOnly({ resize: 'vertical' }) },
  fieldErr: { fontSize: 11, color: colors.red, fontWeight: '600', marginTop: 4 },

  // `.fr`
  fieldRow: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1, minWidth: 0 },
  codeCol: { width: 90 },

  // `.fse`
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.bgWhite,
    gap: 6,
  },
  selectValue: { fontSize: 13, color: colors.textPrimary, flexShrink: 1 },
  selectPlaceholder: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  chevron: { fontSize: 11, color: colors.textMuted },

  optionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  optionCard: {
    backgroundColor: colors.bgWhite,
    borderRadius: radius.lg,
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    ...shadows.lg,
  },
  optionCardCompact: { maxWidth: 200 },
  option: { paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { fontSize: 14, color: colors.textSecondary },
  optionSelected: { color: colors.accent, fontWeight: '700' },

  error: { fontSize: 13, color: colors.red, fontWeight: '600', marginTop: 4 },

  // `.mf`
  footer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnOutline: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: 'transparent',
  },
  btnOutlineText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  btnDark: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: '#374151',
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDarkText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
});
