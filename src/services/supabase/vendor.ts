import { supabase } from './client';

/**
 * Vendor profile service.
 *
 * onboardVendor writes all collected onboarding fields and sets onboarded=true.
 * NOTE: profile_complete is computed automatically by the DB trigger
 * `update_profile_complete` (migration 001) on every vendor UPDATE — it is true
 * when company_name, contact_person, industry, country, city and mobile_number
 * are all present. So we do NOT (and cannot) set it from the client; the trigger
 * owns it. The Share action reads it via selectCanShare.
 */

export interface OnboardVendorInput {
  companyName: string;
  contactPerson: string;
  industry: string;
  categories: string[];
  country: string;
  city: string;
  address?: string;
  mobileNumber: string;
  telCountryCode?: string;
  telNumber?: string;
  description?: string;
}

export interface VendorProfile {
  id: string;
  email: string;
  company_name: string | null;
  contact_person: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  mobile_number: string | null;
  tel_country_code: string | null;
  tel_number: string | null;
  logo_url: string | null;
  description: string | null;
  role: string | null;
  categories: string[] | null;
}

export interface UpdateVendorProfileInput {
  companyName: string;
  contactPerson: string;
  country: string;
  city: string;
  address?: string;
  mobileNumber: string;
  telCountryCode?: string;
  telNumber?: string;
  description?: string;
  /** Optional — only the Settings screen edits these post-onboarding; omit to leave unchanged. */
  industry?: string;
  categories?: string[];
}

export interface ProfileStats {
  inventory: number;
  network: number;
}

export interface VendorPreferences {
  new_shares: boolean;
  reservation_updates: boolean;
  network_invites: boolean;
}

/** Full profile of the current vendor. */
export async function getMyVendor(): Promise<VendorProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  const { data, error } = await supabase
    .from('vendors')
    .select(
      'id, email, company_name, contact_person, industry, country, city, address, mobile_number, tel_country_code, tel_number, logo_url, description, role, categories',
    )
    .eq('id', user.id)
    .single();
  if (error || !data) throw error ?? new Error('Profile not found.');
  return data as VendorProfile;
}

/** Update editable profile fields. profile_complete recomputes via DB trigger. */
export async function updateVendorProfile(input: UpdateVendorProfileInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  // Industry + categories are only edited from the Settings screen; when omitted
  // they stay out of the patch so other callers (Edit Profile) leave them intact.
  const patch: Record<string, unknown> = {
    company_name: input.companyName.trim(),
    contact_person: input.contactPerson.trim(),
    country: input.country,
    city: input.city.trim(),
    address: input.address?.trim() || null,
    mobile_number: input.mobileNumber.trim(),
    tel_country_code: input.telCountryCode?.trim() || null,
    tel_number: input.telNumber?.trim() || null,
    description: input.description?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (input.industry !== undefined) patch.industry = input.industry;
  if (input.categories !== undefined) patch.categories = input.categories;
  const { error } = await supabase.from('vendors').update(patch).eq('id', user.id);
  if (error) throw error;
}

/** Counts for the profile header: inventory items + network size. */
export async function getProfileStats(): Promise<ProfileStats> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  const [invRes, connRes, manRes] = await Promise.all([
    supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('vendor_id', user.id),
    supabase.from('connections').select('*', { count: 'exact', head: true }).eq('status', 'connected'),
    supabase.from('manual_vendors').select('*', { count: 'exact', head: true }),
  ]);
  return { inventory: invRes.count ?? 0, network: (connRes.count ?? 0) + (manRes.count ?? 0) };
}

/** Notification preferences — creates the default row on first read. */
export async function getPreferences(): Promise<VendorPreferences> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  const { data } = await supabase
    .from('vendor_preferences')
    .select('new_shares, reservation_updates, network_invites')
    .eq('vendor_id', user.id)
    .maybeSingle();
  if (data) return data as VendorPreferences;

  const defaults = { new_shares: true, reservation_updates: true, network_invites: false };
  await supabase.from('vendor_preferences').insert({ vendor_id: user.id, ...defaults });
  return defaults;
}

/** Toggle a single notification preference. */
export async function setPreference(patch: Partial<VendorPreferences>): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  const { error } = await supabase
    .from('vendor_preferences')
    .upsert({ vendor_id: user.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'vendor_id' });
  if (error) throw error;
}

/** Permanently delete the account + all owned data (server-side, FK-safe). */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}

export async function onboardVendor(input: OnboardVendorInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { error } = await supabase
    .from('vendors')
    .update({
      company_name: input.companyName.trim(),
      contact_person: input.contactPerson.trim(),
      industry: input.industry,
      categories: input.categories,
      country: input.country,
      city: input.city.trim(),
      address: input.address?.trim() || null,
      mobile_number: input.mobileNumber.trim(),
      tel_country_code: input.telCountryCode?.trim() || null,
      tel_number: input.telNumber?.trim() || null,
      description: input.description?.trim() || null,
      onboarded: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) throw error;
}
