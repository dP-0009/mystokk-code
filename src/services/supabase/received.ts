import { supabase } from './client';
import { photoThumbUrl, toFullUrl } from './storage';

/**
 * Received shares service (privacy chain — Spec §6.1 / §7.2).
 *
 * ALWAYS goes through the get_received_shares / get_received_share SECURITY
 * DEFINER RPCs — never selects the shares table directly. Those RPCs expose
 * source_vendor_id's public company as "shared by" and the effective display
 * price, and deliberately omit original_owner_id + the raw original price.
 */

export interface ReceivedListItem {
  share_id: string;
  inventory_id: string;
  title: string;
  product_code: string | null;
  category: string | null;
  quantity: number;
  quantity_available: number;
  unit: string;
  shared_by_company_name: string | null;
  display_price: number | null;
  display_currency: string | null;
  stock_location: string | null;
  chain_depth: number;
  created_at: string;
  /** Storage path of the item's first photo (from the RPC), or null. */
  first_photo_path: string | null;
  /** Signed thumbnail URL for the first photo, or null when no photo exists. */
  thumbUrl: string | null;
}

/** A packing-list / spec-sheet document, ready to open (short-lived signed URL). */
export interface ReceivedFile {
  url: string;
  name: string;
}

export interface ReceivedShareDetail {
  share_id: string;
  token: string;
  inventory_id: string;
  chain_depth: number;
  status: string;
  created_at: string;
  shared_by_company: string | null;
  shared_by_logo_url: string | null;
  display_price: number | null;
  display_currency: string | null;
  forward_remark: string | null;
  title: string;
  description: string | null;
  category: string | null;
  quantity: number;
  quantity_available: number;
  unit: string;
  origin: string | null;
  specs: Record<string, string> | null;
  inventory_status: string;
  reserved_by_me: number;
  available_to_me: number;
  product_code: string | null;
  stock_location: string | null;
  contact_person: string | null;
  shared_by_email: string | null;
  shared_with: number;
  /** Signed thumbnail URLs (owner's photos, readable via the recipient-read policy). */
  photoUrls: string[];
  /** Signed document URLs + display names. */
  files: ReceivedFile[];
}

/** Raw RPC row — photos/files come back as storage paths and get signed below. */
interface RawShareDetailRow extends Omit<ReceivedShareDetail, 'photoUrls' | 'files'> {
  photos: string[] | null;
  files: { path: string; name: string | null }[] | null;
}

const DOCS_BUCKET = 'inventory-documents';
const SIGNED_TTL = 3600; // 1 hour — documents bucket stays private

/** All active shares received by the current vendor (privacy-safe display fields). */
export async function getReceivedShares(): Promise<ReceivedListItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  // p_vendor_id is ignored server-side (RPC scopes to auth.uid()), passed for signature compat.
  const { data, error } = await supabase.rpc('get_received_shares', { p_vendor_id: user.id });
  if (error) throw error;
  const rows = (data ?? []) as ReceivedListItem[];

  // The inventory-photos bucket is public-read, so build a resized public
  // thumbnail URL (400px/q75) per item — no signing round-trip needed.
  return rows.map((r) => ({
    ...r,
    thumbUrl: r.first_photo_path ? photoThumbUrl(r.first_photo_path) : null,
  }));
}

/** One received share for the detail screen, with photos + files signed for display. */
export async function getReceivedShareDetail(shareId: string): Promise<ReceivedShareDetail> {
  const { data, error } = await supabase.rpc('get_received_share', { p_share_id: shareId });
  if (error) throw error;
  const row = ((data ?? []) as RawShareDetailRow[])[0];
  if (!row) throw new Error('Shared item not found or no longer available.');
  const { photos, files: rawFiles, ...scalars } = row;

  // Public-read photos bucket → plain public object URLs (no image-transform CDN,
  // which is a paid add-on and 404s when disabled). Guarantees the lightbox loads.
  const photoPaths = photos ?? [];
  const photoUrls: string[] = photoPaths.map((p) => toFullUrl(p)).filter(Boolean);

  // Sign the packing-list / spec-sheet documents, keeping their display names.
  const fileRows = rawFiles ?? [];
  let files: ReceivedFile[] = [];
  if (fileRows.length > 0) {
    const { data: signed } = await supabase.storage
      .from(DOCS_BUCKET)
      .createSignedUrls(fileRows.map((f) => f.path), SIGNED_TTL);
    files = fileRows
      .map((f, i) => ({ url: signed?.[i]?.signedUrl ?? '', name: f.name ?? 'Document' }))
      .filter((f) => f.url);
  }

  return { ...scalars, photoUrls, files };
}
