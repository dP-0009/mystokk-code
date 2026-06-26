import { supabase } from './client';

/**
 * Storage service for MyStokk (spec §2.6 + §7).
 *
 * Buckets:
 *   inventory-photos     public-read (migration 032) — owner-only writes; anyone
 *                        with the path can view (resized via image transforms).
 *   inventory-documents  private — owner writes; recipients read via short-lived
 *                        signed URLs (RLS gated by the shares table).
 *   company-logos        public  — logos appear on share cards / public profiles.
 *
 * Path convention (REQUIRED — the RLS policies depend on it):
 *   inventory-photos / inventory-documents : <vendorId>/<inventoryId>/<file>
 *   company-logos                          : <vendorId>/<file>
 * The first folder must equal the uploader's auth uid (owner-write policy);
 * the second folder is the inventory id (recipient-read policy).
 */

/**
 * Inventory list thumbnails render at 96×96 with `object-fit: cover`
 * (documented convention). Components should size the <Image> to this and
 * use resizeMode="cover".
 */
export const PHOTO_THUMBNAIL_SIZE = 96;

const PHOTOS_BUCKET = 'inventory-photos';
const DOCS_BUCKET = 'inventory-documents';
const LOGOS_BUCKET = 'company-logos';

const DEFAULT_SIGNED_URL_TTL = 3600; // 1 hour — short-lived, re-fetched on render

/**
 * Supabase image-transform presets. The inventory-photos bucket is public-read
 * (migration 032), so we serve resized variants via getPublicUrl's `transform`:
 *   thumb  — 400px / q75 for list cards + 72×72 thumbnails
 *   detail — 800px / q80 for detail / landing pages
 * `resize: 'cover'` keeps aspect ratio while filling the box.
 */
const PHOTO_THUMB_TRANSFORM = { width: 400, quality: 75, resize: 'cover' } as const;
const PHOTO_DETAIL_TRANSFORM = { width: 800, quality: 80, resize: 'cover' } as const;

/** Public, resized URL for a product photo (no network round-trip). */
function transformedPhotoUrl(path: string, transform: { width: number; quality: number; resize: 'cover' }): string {
  return supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path, { transform }).data.publicUrl;
}

/** 400px/q75 thumbnail URL for list cards. */
export function photoThumbUrl(path: string): string {
  return transformedPhotoUrl(path, PHOTO_THUMB_TRANSFORM);
}

/** 800px/q80 URL for detail / landing pages. */
export function photoDetailUrl(path: string): string {
  return transformedPhotoUrl(path, PHOTO_DETAIL_TRANSFORM);
}

/** A local file selected via expo-image-picker / expo-document-picker. */
export interface UploadFile {
  uri: string;
  name: string;
  mimeType: string;
}

async function currentVendorId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  return user.id;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Read a local file URI into an ArrayBuffer — the reliable RN upload body. */
async function readFileBody(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

/**
 * Upload a product photo, then record it in inventory_photos.
 * Returns the storage path (store this, not a URL).
 */
export async function uploadInventoryPhoto(
  inventoryId: string,
  file: UploadFile,
): Promise<string> {
  const vendorId = await currentVendorId();
  const path = `${vendorId}/${inventoryId}/${Date.now()}-${sanitizeName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, await readFileBody(file.uri), { contentType: file.mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { count } = await supabase
    .from('inventory_photos')
    .select('id', { count: 'exact', head: true })
    .eq('inventory_id', inventoryId);

  const { error: insertError } = await supabase.from('inventory_photos').insert({
    inventory_id: inventoryId,
    storage_path: path,
    original_name: file.name,
    sort_order: count ?? 0,
  });
  if (insertError) throw insertError;

  return path;
}

/**
 * Upload a spec sheet / certificate, then record it in inventory_files.
 * Returns the storage path.
 */
export async function uploadInventoryDocument(
  inventoryId: string,
  file: UploadFile,
): Promise<string> {
  const vendorId = await currentVendorId();
  const path = `${vendorId}/${inventoryId}/${Date.now()}-${sanitizeName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, await readFileBody(file.uri), { contentType: file.mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from('inventory_files').insert({
    inventory_id: inventoryId,
    storage_path: path,
    original_name: file.name,
  });
  if (insertError) throw insertError;

  return path;
}

/**
 * Upload a company logo to the public bucket and save its public URL on the
 * vendor record. Returns the public URL. (vendorId must be the caller — the
 * owner-write policy enforces the first folder equals the auth uid.)
 */
export async function uploadCompanyLogo(vendorId: string, file: UploadFile): Promise<string> {
  const path = `${vendorId}/logo-${Date.now()}-${sanitizeName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(LOGOS_BUCKET)
    .upload(path, await readFileBody(file.uri), { contentType: file.mimeType, upsert: true });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(LOGOS_BUCKET).getPublicUrl(path);

  const { error: updateError } = await supabase
    .from('vendors')
    .update({ logo_url: publicUrl })
    .eq('id', vendorId);
  if (updateError) throw updateError;

  return publicUrl;
}

/**
 * Short-lived signed URL for a private inventory photo — used when rendering
 * photos for a vendor who received a share. Works for the owner and, via the
 * recipient-read RLS policy, for any vendor holding an active share for the item.
 */
export async function getSignedPhotoUrl(
  storagePath: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data) throw error ?? new Error('Could not sign photo URL.');
  return data.signedUrl;
}

/** Short-lived signed URL for a private inventory document (same access pattern). */
export async function getSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data) throw error ?? new Error('Could not sign document URL.');
  return data.signedUrl;
}
