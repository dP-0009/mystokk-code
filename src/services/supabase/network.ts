import { supabase } from './client';

/**
 * Network service (Build Guide §6.5 / Step 20).
 *
 * The "My Network" list is a UNIFIED view of connected `connections` AND the
 * caller's `manual_vendors`, served by the get_network() SECURITY DEFINER RPC
 * (vendors RLS is self-only, so counterparty fields must come from an RPC).
 *
 * Accept / Reject / Remove are plain writes on `connections` — RLS already
 * permits them for either party — so they run from the client directly.
 */

export interface NetworkVendor {
  row_id: string;
  source: 'connection' | 'manual';
  vendor_id: string | null;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  mobile_number: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  group_name: string | null;
  is_manual: boolean;
  is_registered: boolean;
  status: string;
  created_at: string;
}

export interface PendingConnection {
  connection_id: string;
  vendor_id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  mobile_number: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  created_at: string;
}

export interface VendorProfile {
  vendor_id: string;
  company_name: string | null;
  contact_person: string | null;
  email: string | null;
  mobile_number: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  logo_url: string | null;
  connection_id: string | null;
  status: string | null;
  group_name: string | null;
  connected_since: string | null;
  shared_with_count: number;
  received_from_count: number;
}

export interface ManualVendorInput {
  companyName: string;
  contactPerson?: string;
  email: string;
  mobileNumber?: string;
  industry?: string;
  country?: string;
  city?: string;
  groupName?: string;
}

export interface AddVendorResult {
  connected: boolean; // true → matched a registered vendor and auto-connected
  company: string | null;
}

/** Unified network list (connected vendors + manual contacts). */
export async function getNetwork(): Promise<NetworkVendor[]> {
  const { data, error } = await supabase.rpc('get_network');
  if (error) throw error;
  return (data ?? []) as NetworkVendor[];
}

export interface NetworkFacets {
  industries: string[];
  countries: string[];
  groups: string[];
}

/** Distinct Industry / Country / Group values across the caller's network (for filter dropdowns). */
export async function getNetworkFacets(): Promise<NetworkFacets> {
  const { data, error } = await supabase.rpc('get_network_facets');
  if (error) throw error;
  const f = (data ?? {}) as Partial<NetworkFacets>;
  return { industries: f.industries ?? [], countries: f.countries ?? [], groups: f.groups ?? [] };
}

/** Incoming connection requests awaiting Accept/Reject. */
export async function getPendingConnections(): Promise<PendingConnection[]> {
  const { data, error } = await supabase.rpc('get_pending_connections');
  if (error) throw error;
  return (data ?? []) as PendingConnection[];
}

/** Distinct group names already used, for the Group picker on Add Vendor. */
export async function getGroups(): Promise<string[]> {
  const list = await getNetwork();
  const groups = new Set<string>();
  for (const v of list) {
    if (v.group_name?.trim()) groups.add(v.group_name.trim());
  }
  return [...groups].sort();
}

/**
 * Add a vendor manually. If the email matches an existing registered vendor
 * (case-insensitive), create a connected `connections` row directly; otherwise
 * save a `manual_vendors` row with is_registered=false.
 */
export async function addManualVendor(input: ManualVendorInput): Promise<AddVendorResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const email = input.email.trim();
  const group = input.groupName?.trim() || null;

  const { data: match, error: matchErr } = await supabase.rpc('find_vendor_by_email', { p_email: email });
  if (matchErr) throw matchErr;
  const found = ((match ?? []) as Array<{ vendor_id: string; company_name: string | null }>)[0];

  if (found) {
    const { error } = await supabase.from('connections').insert({
      vendor_id: user.id,
      connected_vendor_id: found.vendor_id,
      status: 'connected',
      group_name: group,
    });
    if (error) {
      // Unique (vendor_id, connected_vendor_id) — already linked.
      if (error.code === '23505') throw new Error('This vendor is already in your network.');
      throw error;
    }
    return { connected: true, company: found.company_name };
  }

  const { error } = await supabase.from('manual_vendors').insert({
    owner_vendor_id: user.id,
    company_name: input.companyName.trim(),
    contact_person: input.contactPerson?.trim() || null,
    email: email || null,
    mobile_number: input.mobileNumber?.trim() || null,
    industry: input.industry?.trim() || null,
    country: input.country?.trim() || null,
    city: input.city?.trim() || null,
    group_name: group,
    is_registered: false,
  });
  if (error) throw error;
  return { connected: false, company: input.companyName.trim() };
}

/** Accept an incoming connection request. */
export async function acceptConnection(connectionId: string): Promise<void> {
  const { error } = await supabase
    .from('connections')
    .update({ status: 'connected', updated_at: new Date().toISOString() })
    .eq('connection_id', connectionId);
  if (error) throw error;
}

/** Reject an incoming connection request. */
export async function rejectConnection(connectionId: string): Promise<void> {
  const { error } = await supabase
    .from('connections')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('connection_id', connectionId);
  if (error) throw error;
}

/** Remove a network entry: delete the connection (registered) or manual row. */
export async function removeNetworkVendor(source: 'connection' | 'manual', rowId: string): Promise<void> {
  const table = source === 'manual' ? 'manual_vendors' : 'connections';
  const idCol = source === 'manual' ? 'id' : 'connection_id';
  const { error } = await supabase.from(table).delete().eq(idCol, rowId);
  if (error) throw error;
}

export interface ManualVendorRow {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  mobile_number: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  group_name: string | null;
}

/** Load one manual contact the caller owns (for editing). */
export async function getManualVendor(manualId: string): Promise<ManualVendorRow> {
  const { data, error } = await supabase
    .from('manual_vendors')
    .select('id, company_name, contact_person, email, mobile_number, industry, country, city, group_name')
    .eq('id', manualId)
    .single();
  if (error || !data) throw error ?? new Error('Contact not found.');
  return data as ManualVendorRow;
}

/** Edit a manual contact's details (manual_vendors row the caller owns). */
export async function updateManualVendor(manualId: string, input: Partial<ManualVendorRow>): Promise<void> {
  const { error } = await supabase
    .from('manual_vendors')
    .update({
      company_name: input.company_name?.trim(),
      contact_person: input.contact_person?.trim() || null,
      email: input.email?.trim() || null,
      mobile_number: input.mobile_number?.trim() || null,
      industry: input.industry?.trim() || null,
      country: input.country?.trim() || null,
      city: input.city?.trim() || null,
      group_name: input.group_name?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', manualId);
  if (error) throw error;
}

/** Set the group label on a connection (the only field a vendor can edit on a registered counterparty). */
export async function updateConnectionGroup(connectionId: string, group: string | null): Promise<void> {
  const { error } = await supabase
    .from('connections')
    .update({ group_name: group?.trim() || null, updated_at: new Date().toISOString() })
    .eq('connection_id', connectionId);
  if (error) throw error;
}

/** Full counterparty profile + activity for the Vendor Detail screen. */
export async function getVendorProfile(vendorId: string): Promise<VendorProfile> {
  const { data, error } = await supabase.rpc('get_vendor_profile', { p_vendor_id: vendorId });
  if (error) throw error;
  const row = ((data ?? []) as VendorProfile[])[0];
  if (!row) throw new Error('Vendor not found in your network.');
  return row;
}

/** Bulk import parsed CSV rows. Returns { imported, duplicates }. */
export async function bulkImportVendors(
  rows: Record<string, string>[],
): Promise<{ imported: number; duplicates: number }> {
  const { data, error } = await supabase.rpc('bulk_import_vendors', { p_rows: rows });
  if (error) throw error;
  return (data ?? { imported: 0, duplicates: 0 }) as { imported: number; duplicates: number };
}
