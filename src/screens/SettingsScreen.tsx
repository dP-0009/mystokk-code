import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm } from 'react-hook-form';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { MainLayout, PageBody, PageHeader } from '../components/layout';
import { FormTextField } from '../components/shared/FormTextField';
import { PhoneField } from '../components/shared/PhoneField';
import { SelectField } from '../components/shared/SelectField';
import { DropdownSelectField } from '../components/shared/DropdownSelectField';
import { AppButton } from '../components/shared/AppButton';
import {
  deleteMyAccount,
  getMyVendor,
  updateVendorProfile,
  type VendorProfile,
} from '../services/supabase/vendor';
import { uploadCompanyLogo, type UploadFile } from '../services/supabase/storage';
import { changePassword } from '../services/supabase/auth';
import { useAuthStore } from '../stores/authStore';
import { usePushStore } from '../stores/pushStore';
import { COUNTRIES, SETTINGS_INDUSTRIES, SETTINGS_INDUSTRY_CATEGORIES } from '../constants/industries';
import { webOnly } from '../components/layout/web';
import { colors, radius, shadows } from '../theme/tokens';
import { toast } from '../stores/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

/** Fingerprint of the editable profile fields — changes whenever the saved DB
 *  values change, so the form below remounts and re-reads them. */
function profileFingerprint(v: VendorProfile): string {
  return [
    v.company_name,
    v.contact_person,
    v.industry,
    (v.categories ?? []).join(','),
    v.country,
    v.city,
    v.address,
    v.mobile_number,
    v.tel_country_code,
    v.tel_number,
    v.description,
    v.logo_url,
  ]
    .map((x) => x ?? '')
    .join('|');
}

export function SettingsScreen({ navigation: _navigation }: Props): React.JSX.Element {
  const signOut = useAuthStore((s) => s.signOut);
  const session = useAuthStore((s) => s.session);
  const accountEmail = session?.user?.email ?? '—';
  const emailVerified = Boolean(session?.user?.email_confirmed_at);

  // FIX 6 — always reload the SAVED profile from the DB on mount/focus, and
  // remount the form so it resets to those values (no stale cache, no leftover
  // unsaved edits when leaving and returning). No module-level state is used.
  const { data: vendor, isLoading, refetch } = useQuery({
    queryKey: ['myVendor'],
    queryFn: getMyVendor,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  // Bump on every focus so the form below remounts (resets to DB values), and
  // refetch so it remounts again against fresh data once it lands.
  const [focusNonce, setFocusNonce] = useState(0);
  useFocusEffect(
    React.useCallback(() => {
      setFocusNonce((n) => n + 1);
      void refetch();
    }, [refetch]),
  );

  // Change Password + Delete Account flows (preserved from the prior screen).
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState('');

  const pwMutation = useMutation({
    mutationFn: () => changePassword(pw),
    onSuccess: () => {
      setPwOpen(false);
      setPw('');
      setPw2('');
      toast('Password updated.');
    },
    onError: (e) => Alert.alert('Could not change password', e instanceof Error ? e.message : 'Try again.'),
  });
  const delMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => void signOut(),
    onError: (e) => Alert.alert('Could not delete account', e instanceof Error ? e.message : 'Try again.'),
  });

  const pwValid = pw.length >= 8 && pw === pw2;
  const delValid = delText.trim().toUpperCase() === 'DELETE';

  // Push preference — shared with the Settings → Notification Preferences toggle.
  const pushEnabled = usePushStore((s) => s.enabled);
  const pushBusy = usePushStore((s) => s.busy);
  const hydratePush = usePushStore((s) => s.hydrate);
  const setPushEnabled = usePushStore((s) => s.setEnabled);
  useEffect(() => {
    void hydratePush();
  }, [hydratePush]);

  const togglePush = async (): Promise<void> => {
    const next = !pushEnabled;
    try {
      await setPushEnabled(next);
      if (Platform.OS === 'web' && next) {
        toast('Notifications on. Push delivery is available in the MyStokk mobile app.');
      } else {
        toast(next ? 'Notifications enabled.' : 'Notifications disabled.');
      }
    } catch {
      toast('Could not update notifications.');
    }
  };

  return (
    <MainLayout active="settings">
      <PageHeader title="Profile" subtitle="Manage your account and company profile" />

      <PageBody contentContainerStyle={styles.column}>
        {/* Account — read-only email / role / verification (no "Hi …" greeting) */}
        <View style={styles.accountCard}>
          <View style={styles.accountHeader}>
            <Ionicons name="person-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.accountTitle}>Account</Text>
          </View>
          <Text style={styles.roLabel}>Email</Text>
          <View style={styles.roField}>
            <Text style={styles.roText} numberOfLines={1}>
              {accountEmail}
            </Text>
          </View>
          <View style={styles.accountRow}>
            <View style={styles.accountCol}>
              <Text style={styles.roLabel}>Role</Text>
              <View style={styles.roField}>
                <Text style={styles.roText}>Vendor</Text>
              </View>
            </View>
            <View style={styles.accountCol}>
              <Text style={styles.roLabel}>Email Verified</Text>
              <View style={styles.roField}>
                <Text style={[styles.roText, emailVerified ? styles.roVerified : null]}>
                  {emailVerified ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Company Profile */}
        <Text style={styles.sectionTitle}>Company Profile</Text>
        {isLoading || !vendor ? (
          <View style={[styles.card, styles.cardPadded, styles.center]}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          // key → remount (reset to DB values) on every focus and when the
          // refetched profile differs from what's shown.
          <CompanyProfileForm key={`${focusNonce}-${profileFingerprint(vendor)}`} vendor={vendor} />
        )}

        {/* Push Notifications — hidden once enabled (via this button or the
            Settings → Notification Preferences toggle, same shared state). */}
        {!pushEnabled ? (
          <>
            <Text style={styles.sectionTitle}>Push Notifications</Text>
            <View style={styles.nbBox}>
              <View style={styles.nbText}>
                <Text style={styles.nbTitle}>Push Notifications</Text>
                <Text style={styles.nbSub}>Get instant alerts for reservations and messages</Text>
                <Text style={styles.nbHint}>Enable to never miss a reservation request</Text>
              </View>
              <Pressable
                style={[styles.btnAccent, pushBusy ? styles.btnAccentBusy : null]}
                onPress={() => void togglePush()}
                disabled={pushBusy}
                testID="settings-enable-push"
              >
                <Text style={styles.btnAccentText}>Enable Notifications</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {/* Account security (preserved) */}
        <View style={styles.securityRow}>
          <Pressable style={styles.btnOutline} onPress={() => setPwOpen(true)} testID="settings-change-password">
            <Text style={styles.btnOutlineText}>Change Password</Text>
          </Pressable>
          <Pressable style={styles.btnDanger} onPress={() => setDelOpen(true)} testID="settings-delete-account">
            <Text style={styles.btnDangerText}>Delete Account</Text>
          </Pressable>
        </View>
      </PageBody>

      {/* Change Password sheet */}
      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setPwOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Change Password</Text>
            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={pw}
              onChangeText={setPw}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={pw2}
              onChangeText={setPw2}
              placeholder="Re-enter password"
              placeholderTextColor={colors.textMuted}
            />
            {pw.length > 0 && pw.length < 8 ? <Text style={styles.hintErr}>Minimum 8 characters.</Text> : null}
            {pw2.length > 0 && pw !== pw2 ? <Text style={styles.hintErr}>Passwords don't match.</Text> : null}
            <AppButton
              title="Update Password"
              onPress={() => pwMutation.mutate()}
              loading={pwMutation.isPending}
              disabled={!pwValid}
              style={styles.sheetBtn}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Account sheet */}
      <Modal visible={delOpen} transparent animationType="fade" onRequestClose={() => setDelOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setDelOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Delete Account</Text>
            <View style={styles.warn}>
              <Text style={styles.warnText}>
                This permanently deletes your account, inventory, shares, and reservations. This cannot
                be undone.
              </Text>
            </View>
            <Text style={styles.fieldLabel}>Type DELETE to confirm</Text>
            <TextInput
              style={styles.input}
              value={delText}
              onChangeText={setDelText}
              autoCapitalize="characters"
              placeholder="DELETE"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              style={[styles.deleteConfirm, !delValid || delMutation.isPending ? styles.deleteDisabled : null]}
              disabled={!delValid || delMutation.isPending}
              onPress={() => delMutation.mutate()}
            >
              {delMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteConfirmText}>Permanently Delete Account</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </MainLayout>
  );
}

interface FormShape {
  companyName: string;
  contactPerson: string;
  industry: string;
  country: string;
  city: string;
  address: string;
  mobileNumber: string;
  telNumber: string;
  description: string;
}

function CompanyProfileForm({ vendor }: { vendor: VendorProfile }): React.JSX.Element {
  const queryClient = useQueryClient();
  const refreshVendor = useAuthStore((s) => s.refreshVendor);
  const [logo, setLogo] = useState<UploadFile | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(vendor.logo_url);
  const [categories, setCategories] = useState<string[]>(vendor.categories ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, watch } = useForm<FormShape>({
    defaultValues: {
      companyName: vendor.company_name ?? '',
      contactPerson: vendor.contact_person ?? '',
      industry: vendor.industry ?? '',
      country: vendor.country ?? '',
      city: vendor.city ?? '',
      address: vendor.address ?? '',
      mobileNumber: vendor.mobile_number ?? '',
      // Combine the legacy split tel columns so PhoneField shows the dial code too.
      telNumber: vendor.tel_country_code
        ? `${vendor.tel_country_code}${vendor.tel_number ?? ''}`
        : vendor.tel_number ?? '',
      description: vendor.description ?? '',
    },
  });

  // Categories shown depend on the chosen industry.
  const industry = watch('industry');
  const categoryOptions = SETTINGS_INDUSTRY_CATEGORIES[industry] ?? [];
  // Selected country drives the phone dial-code auto-fill.
  const country = watch('country');

  // When the user CHANGES industry, drop any selected categories that no longer
  // belong to it. Skip the initial render so saved categories aren't wiped.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const allowed = SETTINGS_INDUSTRY_CATEGORIES[industry] ?? [];
    setCategories((prev) => prev.filter((c) => allowed.includes(c)));
  }, [industry]);

  const toggleCategory = (c: string): void =>
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const pickLogo = async (): Promise<void> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled || res.assets.length === 0) return;
    const a = res.assets[0];
    setLogo({ uri: a.uri, name: a.fileName ?? `logo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg' });
    setLogoUrl(a.uri);
  };

  const submit = handleSubmit(async (v) => {
    setError(null);
    setSubmitting(true);
    try {
      if (logo) await uploadCompanyLogo(vendor.id, logo);
      await updateVendorProfile({
        companyName: v.companyName,
        contactPerson: v.contactPerson,
        industry: v.industry,
        categories,
        country: v.country,
        city: v.city,
        address: v.address,
        mobileNumber: v.mobileNumber,
        telNumber: v.telNumber,
        description: v.description,
      });
      await refreshVendor(); // re-evaluate profile_complete for the Share gate
      void queryClient.invalidateQueries({ queryKey: ['myVendor'] });
      void queryClient.invalidateQueries({ queryKey: ['profileStats'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Profile saved successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save changes.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <View style={[styles.card, styles.cardPadded]}>
      {/* Logo */}
      <Text style={styles.formLabel}>Company Logo</Text>
      <View style={styles.logoRow}>
        <View style={styles.logoBox}>
          {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logoImg} /> : <Text style={styles.logoIcon}>🏢</Text>}
        </View>
        <Pressable style={styles.btnOutlineSm} onPress={() => void pickLogo()} testID="settings-upload-logo">
          <Text style={styles.btnOutlineSmText}>Upload Logo</Text>
        </Pressable>
      </View>

      <FormTextField
        control={control}
        name="companyName"
        label="Company Name *"
        autoCapitalize="words"
        rules={{ required: 'Company name is required' }}
      />
      <FormTextField
        control={control}
        name="contactPerson"
        label="Contact Person *"
        autoCapitalize="words"
        rules={{ required: 'Contact person is required' }}
      />
      <DropdownSelectField
        control={control}
        name="industry"
        label="Industry"
        placeholder="Select industry"
        options={SETTINGS_INDUSTRIES}
        required
        rules={{ required: 'Industry is required' }}
      />

      {/* Categories — filtered to the selected industry */}
      <Text style={styles.formLabel}>Categories</Text>
      {categoryOptions.length === 0 ? (
        <Text style={styles.chipsHint}>Select an industry to see its categories.</Text>
      ) : (
        <View style={styles.chips}>
          {categoryOptions.map((c) => {
            const sel = categories.includes(c);
            return (
              <Pressable
                key={c}
                style={[styles.chip, sel ? styles.chipSel : null]}
                onPress={() => toggleCategory(c)}
                testID={`settings-category-${c}`}
              >
                <Text style={[styles.chipText, sel ? styles.chipTextSel : null]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.fieldRow}>
        <View style={styles.flex1}>
          <FormTextField
            control={control}
            name="city"
            label="City *"
            autoCapitalize="words"
            rules={{ required: 'City is required' }}
          />
        </View>
        <View style={styles.flex1}>
          <SelectField
            control={control}
            name="country"
            label="Country"
            placeholder="Select country"
            options={COUNTRIES}
            required
            rules={{ required: 'Country is required' }}
          />
        </View>
      </View>

      <PhoneField
        control={control}
        name="mobileNumber"
        label="Mobile/WhatsApp *"
        countryName={country}
        placeholder="Phone number"
        rules={{ required: 'Mobile is required' }}
      />
      <PhoneField
        control={control}
        name="telNumber"
        label="Tel Number"
        countryName={country}
        placeholder="Telephone (optional)"
      />

      <FormTextField control={control} name="address" label="Address" autoCapitalize="words" />
      <FormTextField control={control} name="description" label="Description" autoCapitalize="sentences" multiline />

      {error ? <Text style={styles.formError}>{error}</Text> : null}
      <AppButton title="Save Profile" variant="dark" onPress={() => void submit()} loading={submitting} style={styles.saveBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  // 700px centered column (mirror `.pb{max-width:700px}`)
  column: { maxWidth: 700, width: '100%', alignSelf: 'center' },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },

  // `.ss-card` — no overflow clip so the Industry dropdown panel can float out.
  card: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    marginBottom: 28,
  },
  cardPadded: { padding: 20 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

  // Account card (read-only email / role / verification)
  accountCard: {
    backgroundColor: colors.bgWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 28,
  },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  accountTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  accountRow: { flexDirection: 'row', gap: 16, marginTop: 14 },
  accountCol: { flex: 1, minWidth: 0 },
  roLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
  roField: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgPage,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  roText: { fontSize: 13, color: colors.textMuted },
  roVerified: { color: colors.green, fontWeight: '700' },

  // Form
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.bgChip,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  logoIcon: { fontSize: 24 },

  fieldRow: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1, minWidth: 0 },

  // `.cchips` / `.cc`
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgWhite,
  },
  chipSel: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  chipTextSel: { color: colors.accent },
  chipsHint: { fontSize: 12, color: colors.textMuted, marginBottom: 16 },

  formError: { color: colors.red, fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 4 },
  saveBtn: { marginTop: 8 },

  // Buttons
  btnOutlineSm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: colors.bgWhite,
  },
  btnOutlineSmText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },

  // `.nb-box`
  nbBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: colors.bgWhite,
    marginBottom: 28,
  },
  nbText: { flexShrink: 1 },
  nbTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  nbSub: { fontSize: 13, color: colors.textSecondary },
  nbHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  // `.btn-a`
  btnAccent: {
    backgroundColor: colors.accent,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    flexShrink: 0,
    ...webOnly({ cursor: 'pointer' }),
  },
  btnAccentOn: { backgroundColor: colors.green },
  btnAccentBusy: { opacity: 0.6 },
  btnAccentText: { color: colors.bgWhite, fontSize: 13, fontWeight: '600' },

  // Security actions
  securityRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  btnOutline: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    backgroundColor: colors.bgWhite,
  },
  btnOutlineText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  btnDanger: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.redLight,
    backgroundColor: colors.redLight,
  },
  btnDangerText: { fontSize: 13, fontWeight: '600', color: colors.red },

  // Modals
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.bgWhite,
    borderRadius: radius.xl,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    ...shadows.lg,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  hintErr: { fontSize: 11.5, color: colors.red, fontWeight: '600', marginBottom: 6 },
  sheetBtn: { marginTop: 14 },
  warn: { backgroundColor: colors.redLight, borderRadius: radius.md, padding: 12, marginBottom: 16 },
  warnText: { fontSize: 12.5, color: colors.red, lineHeight: 18 },
  deleteConfirm: {
    backgroundColor: colors.red,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 14,
  },
  deleteConfirmText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  deleteDisabled: { opacity: 0.45 },
});
