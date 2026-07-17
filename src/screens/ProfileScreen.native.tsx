import React from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MystokkLoader } from '../components/shared/MystokkLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation';
import { getMyVendor, updateVendorProfile, deleteMyAccount, type VendorProfile } from '../services/supabase/vendor';
import { uploadCompanyLogo, type UploadFile } from '../services/supabase/storage';
import { changePassword } from '../services/supabase/auth';
import { useAuthStore } from '../stores/authStore';
import { SETTINGS_INDUSTRIES, SETTINGS_INDUSTRY_CATEGORIES, COUNTRIES } from '../constants/industries';
import { DIAL_OPTIONS, combinePhone, dialFromOption, splitPhone } from '../constants/countries';
import { toast } from '../stores/toast';
import {
  Avatar,
  Badge,
  Button,
  CategoryChip,
  CategoryChipGroup,
  GlassPanel,
  Icon,
  NavBar,
  PickerSheet,
  ScreenBackground,
  SectionLabel,
  Select,
  Sheet,
  TextArea,
  TextField,
  colors,
  glass,
  layout,
  radii,
  spacing,
} from '../components/mobile';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const DEFAULT_DIAL = '+971';
type PickerId = 'industry' | 'country' | 'mobileDial' | null;

/** Business profile (prototype SCREENS.profile). Editable form + change password / delete. */
export function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { data: vendor, isLoading } = useQuery({ queryKey: ['myVendor'], queryFn: getMyVendor, staleTime: 30_000 });

  return (
    <ScreenBackground>
      <NavBar title="Business profile" onBack={() => navigation.goBack()} />
      {isLoading || !vendor ? (
        <View style={styles.center}>
          <MystokkLoader />
        </View>
      ) : (
        <ProfileForm vendor={vendor} insetsTop={insets.top} insetsBottom={insets.bottom} />
      )}
    </ScreenBackground>
  );
}

function ProfileForm({ vendor, insetsTop, insetsBottom }: { vendor: VendorProfile; insetsTop: number; insetsBottom: number }): React.JSX.Element {
  const queryClient = useQueryClient();
  const refreshVendor = useAuthStore((s) => s.refreshVendor);
  const signOut = useAuthStore((s) => s.signOut);
  const session = useAuthStore((s) => s.session);
  const email = session?.user?.email ?? '—';
  const emailVerified = Boolean(session?.user?.email_confirmed_at);

  const [companyName, setCompanyName] = React.useState(vendor.company_name ?? '');
  const [contactPerson, setContactPerson] = React.useState(vendor.contact_person ?? '');
  const [industry, setIndustry] = React.useState(vendor.industry ?? '');
  const [categories, setCategories] = React.useState<string[]>(vendor.categories ?? []);
  const [city, setCity] = React.useState(vendor.city ?? '');
  const [country, setCountry] = React.useState(vendor.country ?? '');
  const [mobile, setMobile] = React.useState(vendor.mobile_number ?? '');
  const [description, setDescription] = React.useState(vendor.description ?? '');
  const [logo, setLogo] = React.useState<UploadFile | null>(null);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(vendor.logo_url);
  const [picker, setPicker] = React.useState<PickerId>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [pwOpen, setPwOpen] = React.useState(false);
  const [delOpen, setDelOpen] = React.useState(false);

  const mobileParts = splitPhone(mobile);
  const categoryOptions = industry ? SETTINGS_INDUSTRY_CATEGORIES[industry] ?? [] : [];

  const onIndustry = (v: string): void => {
    setIndustry(v);
    const allowed = SETTINGS_INDUSTRY_CATEGORIES[v] ?? [];
    setCategories((cur) => cur.filter((c) => allowed.includes(c)));
  };

  const pickLogo = async (): Promise<void> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (res.canceled || res.assets.length === 0) return;
    const a = res.assets[0];
    setLogo({ uri: a.uri, name: a.fileName ?? `logo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg' });
    setLogoUrl(a.uri);
  };

  const save = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      if (logo) await uploadCompanyLogo(vendor.id, logo);
      await updateVendorProfile({
        companyName,
        contactPerson,
        industry,
        categories,
        country,
        city,
        address: vendor.address ?? '',
        mobileNumber: mobile,
        telNumber: vendor.tel_country_code ? `${vendor.tel_country_code}${vendor.tel_number ?? ''}` : vendor.tel_number ?? '',
        description,
      });
      await refreshVendor();
      void queryClient.invalidateQueries({ queryKey: ['myVendor'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Profile saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save changes.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insetsTop + layout.navHeight - 56, paddingBottom: insetsBottom + 110 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header card */}
          <GlassPanel radius={radii.card} style={styles.headerCard}>
            <Pressable onPress={() => void pickLogo()}>
              {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logo} /> : <Avatar name={companyName || 'MyStokk'} size={72} gradient="nav" />}
            </Pressable>
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>
                {companyName || 'Your company'}
              </Text>
              <Text style={styles.headerEmail} numberOfLines={1}>
                {email} · Vendor
              </Text>
              <View style={styles.headerBadges}>
                <Text style={styles.changeLogo} onPress={() => void pickLogo()}>
                  Change logo
                </Text>
                {emailVerified ? <Badge label="Email verified" tone="green" /> : <Badge label="Unverified" tone="amber" />}
              </View>
            </View>
          </GlassPanel>

          <SectionLabel>Company</SectionLabel>
          <TextField label="Company name" required value={companyName} onChangeText={setCompanyName} autoCapitalize="words" />
          <TextField label="Contact person" required value={contactPerson} onChangeText={setContactPerson} autoCapitalize="words" />
          <Select label="Industry" required placeholder="Select industry" value={industry || undefined} onPress={() => setPicker('industry')} />

          <Text style={styles.catsLabel}>Categories</Text>
          {categoryOptions.length === 0 ? (
            <Text style={styles.catsHint}>Select an industry to see its categories.</Text>
          ) : (
            <View style={styles.catsWrap}>
              <CategoryChipGroup>
                {categoryOptions.map((c) => (
                  <CategoryChip key={c} label={c} selected={categories.includes(c)} onPress={() => setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))} />
                ))}
              </CategoryChipGroup>
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.col}>
              <TextField label="City" required value={city} onChangeText={setCity} autoCapitalize="words" />
            </View>
            <View style={styles.col}>
              <Select label="Country" required placeholder="Select country" value={country || undefined} onPress={() => setPicker('country')} />
            </View>
          </View>

          <View style={styles.phoneRow}>
            <Select label="Code" value={mobileParts.dial || DEFAULT_DIAL} onPress={() => setPicker('mobileDial')} style={styles.dial} />
            <TextField
              label="Mobile / WhatsApp"
              required
              value={mobileParts.number}
              onChangeText={(n) => setMobile(combinePhone(mobileParts.dial || DEFAULT_DIAL, n))}
              keyboardType="phone-pad"
              style={styles.phoneNum}
            />
          </View>

          <TextArea label="Description" value={description} onChangeText={setDescription} autoCapitalize="sentences" />

          <View style={styles.secRow}>
            <Button label="Change password" variant="ghost" size="sm" onPress={() => setPwOpen(true)} style={styles.secBtn} />
            <Button label="Delete account" variant="danger" size="sm" onPress={() => setDelOpen(true)} style={styles.secBtn} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Save */}
      <View style={[styles.cta, { paddingBottom: insetsBottom + 20 }]}>
        <Button label={submitting ? 'Saving…' : 'Save profile'} variant="primary" onPress={() => void save()} disabled={submitting} />
      </View>

      <PickerSheetsHost picker={picker} setPicker={setPicker} industry={industry} country={country} onIndustry={onIndustry} setCountry={setCountry} mobileParts={mobileParts} setMobile={setMobile} />

      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
      <DeleteAccountSheet open={delOpen} onClose={() => setDelOpen(false)} onDeleted={() => void signOut()} />
    </>
  );
}

function PickerSheetsHost({
  picker,
  setPicker,
  industry,
  country,
  onIndustry,
  setCountry,
  mobileParts,
  setMobile,
}: {
  picker: PickerId;
  setPicker: (p: PickerId) => void;
  industry: string;
  country: string;
  onIndustry: (v: string) => void;
  setCountry: (v: string) => void;
  mobileParts: { dial: string; number: string };
  setMobile: (v: string) => void;
}): React.JSX.Element {
  return (
    <>
      <PickerSheet open={picker === 'industry'} onClose={() => setPicker(null)} title="Industry" options={SETTINGS_INDUSTRIES} value={industry} onSelect={onIndustry} />
      <PickerSheet open={picker === 'country'} onClose={() => setPicker(null)} title="Country" options={COUNTRIES} value={country} onSelect={setCountry} />
      <PickerSheet open={picker === 'mobileDial'} onClose={() => setPicker(null)} title="Country code" options={DIAL_OPTIONS} onSelect={(opt) => setMobile(combinePhone(dialFromOption(opt), mobileParts.number))} />
    </>
  );
}

function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setPw('');
      setPw2('');
    }
  }, [open]);
  const valid = pw.length >= 8 && pw === pw2;
  const submit = async (): Promise<void> => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await changePassword(pw);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Password updated');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change password.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Change password">
      <TextField label="New password" value={pw} onChangeText={setPw} secureTextEntry placeholder="At least 8 characters" autoCapitalize="none" />
      <TextField label="Confirm password" value={pw2} onChangeText={setPw2} secureTextEntry placeholder="Re-enter password" autoCapitalize="none" error={pw2.length > 0 && pw !== pw2 ? 'Passwords do not match' : undefined} />
      <Button label={busy ? 'Updating…' : 'Update password'} variant="primary" onPress={() => void submit()} disabled={!valid || busy} />
    </Sheet>
  );
}

function DeleteAccountSheet({ open, onClose, onDeleted }: { open: boolean; onClose: () => void; onDeleted: () => void }): React.JSX.Element {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setText('');
  }, [open]);
  const valid = text.trim().toUpperCase() === 'DELETE';
  const submit = async (): Promise<void> => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await deleteMyAccount();
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete account.');
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Delete account" description="This permanently deletes your account, inventory, shares, and reservations. This cannot be undone.">
      <TextField label="Type DELETE to confirm" value={text} onChangeText={setText} autoCapitalize="characters" placeholder="DELETE" />
      <Button label={busy ? 'Deleting…' : 'Permanently delete account'} variant="danger" onPress={() => void submit()} disabled={!valid || busy} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.gutter },

  headerCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginTop: 12, marginBottom: 4 },
  logo: { width: 72, height: 72, borderRadius: 20 },
  headerInfo: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 17, fontWeight: '700', color: colors.navy },
  headerEmail: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  changeLogo: { fontSize: 12.5, fontWeight: '800', color: colors.blue },

  catsLabel: { fontSize: 13, fontWeight: '800', color: colors.navy, marginBottom: 8 },
  catsHint: { fontSize: 12.5, color: colors.muted, marginBottom: 14 },
  catsWrap: { marginBottom: 14 },

  row: { flexDirection: 'row', gap: 11 },
  col: { flex: 1 },
  phoneRow: { flexDirection: 'row', gap: 11 },
  dial: { width: 104 },
  phoneNum: { flex: 1 },

  secRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secBtn: { flex: 1 },
  error: { color: colors.red, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 12 },

  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.gutter, paddingTop: 12, backgroundColor: 'transparent' },
});
