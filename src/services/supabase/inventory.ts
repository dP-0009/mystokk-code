import { supabase } from './client';
import { photoDetailUrl, photoThumbUrl } from './storage';
import type { InventoryStatus } from '../../constants/inventory';

const SIGNED_TTL = 3600;

export interface InventoryListItem {
  inventory_id: string;
  title: string;
  product_code: string | null;
  category: string | null;
  quantity: number;
  quantity_available: number;
  unit: string;
  currency: string;
  price: number | null;
  status: InventoryStatus;
  shared_count: number;
  /** Open reservation requests on this item awaiting the owner's response. */
  pending_count: number;
  created_at: string;
  thumbUrl: string | null;
}

export interface InventoryItem {
  inventory_id: string;
  vendor_id: string;
  title: string;
  product_code: string | null;
  category: string | null;
  industry: string | null;
  description: string | null;
  quantity: number;
  quantity_available: number;
  unit: string;
  currency: string;
  price: number | null;
  origin: string | null;
  stock_location: string | null;
  status: InventoryStatus;
  shared_count: number;
  specs: Record<string, string>;
  created_at: string;
  /** Provenance (owner-only): set when this item was created by editing a received share. */
  edited_from_share_id: string | null;
  edited_from_company: string | null;
  edited_from_title: string | null;
}

/** Where an edited copy came from — recorded when saving an edited received item. */
export interface InventoryProvenance {
  editedFromShareId: string;
  editedFromCompany: string | null;
  editedFromTitle: string | null;
}

export interface ShareActivity {
  recipient_company: string | null;
  shared_at: string;
}

export interface ItemReservation {
  reservation_id: string;
  requester_company: string | null;
  quantity: number;
  offered_price: number | null;
  status: string;
  created_at: string;
}

/** A saved inventory document (spec sheet, certificate, …) with a signed URL. */
export interface InventoryDocument {
  name: string;
  url: string;
  storage_path: string;
}

export interface InventoryDetail {
  item: InventoryItem;
  photoUrls: string[];
  /** Storage paths for each photo (same order as photoUrls) — needed to delete. */
  photoPaths: string[];
  documents: InventoryDocument[];
  shareActivity: ShareActivity[];
  reservations: ItemReservation[];
}

export interface InventoryInput {
  title: string;
  productCode?: string;
  /** Optional — Industry + Category are optional taxonomy fields on the item form. */
  category?: string | null;
  industry?: string | null;
  quantity: number;
  unit: string;
  price?: number | null;
  currency: string;
  origin?: string;
  stockLocation?: string;
  description?: string;
}

interface PhotoRow {
  storage_path: string;
  sort_order: number;
}

const LIST_COLUMNS =
  'inventory_id, title, product_code, category, quantity, quantity_available, unit, currency, price, status, shared_count, created_at, inventory_photos(storage_path, sort_order)';

/** List the current vendor's inventory, optionally filtered + searched. */
export async function listInventory(
  status: InventoryStatus | null,
  search: string,
): Promise<InventoryListItem[]> {
  let query = supabase.from('inventory').select(LIST_COLUMNS).order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const term = search.trim().replace(/[,()%]/g, '');
  if (term) query = query.or(`title.ilike.%${term}%,product_code.ilike.%${term}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<
    Omit<InventoryListItem, 'thumbUrl'> & { inventory_photos: PhotoRow[] }
  >;

  // Collect the first photo of each item. The bucket is public-read, so we build
  // resized public URLs directly (no signing round-trip).
  const firstPaths = new Map<string, string>();
  for (const r of rows) {
    const first = [...(r.inventory_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
    if (first) firstPaths.set(r.inventory_id, first.storage_path);
  }

  // Tally pending reservations per item. RLS scopes reservations to ones the
  // vendor is party to; for owned items the vendor is the responder, so these
  // are exactly their open requests.
  const itemIds = rows.map((r) => r.inventory_id);
  const { data: pendingData } =
    itemIds.length > 0
      ? await supabase.from('reservations').select('inventory_id').in('inventory_id', itemIds).eq('status', 'pending')
      : { data: [] as { inventory_id: string }[] };

  const pendingCounts = new Map<string, number>();
  for (const rr of (pendingData ?? []) as { inventory_id: string }[]) {
    pendingCounts.set(rr.inventory_id, (pendingCounts.get(rr.inventory_id) ?? 0) + 1);
  }

  return rows.map((r) => {
    const path = firstPaths.get(r.inventory_id);
    return {
      inventory_id: r.inventory_id,
      title: r.title,
      product_code: r.product_code,
      category: r.category,
      quantity: r.quantity,
      quantity_available: r.quantity_available,
      unit: r.unit,
      currency: r.currency,
      price: r.price,
      status: r.status,
      shared_count: r.shared_count,
      pending_count: pendingCounts.get(r.inventory_id) ?? 0,
      created_at: r.created_at,
      thumbUrl: path ? photoThumbUrl(path) : null,
    };
  });
}

/** Full detail for an owned item: fields, signed photos, share activity, reservations. */
export async function getInventoryDetail(inventoryId: string): Promise<InventoryDetail> {
  const [itemRes, photoRes, fileRes, activityRes, resvRes] = await Promise.all([
    supabase.from('inventory').select('*').eq('inventory_id', inventoryId).single(),
    supabase
      .from('inventory_photos')
      .select('storage_path, sort_order')
      .eq('inventory_id', inventoryId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('inventory_files')
      .select('storage_path, original_name')
      .eq('inventory_id', inventoryId)
      .order('uploaded_at', { ascending: true }),
    supabase.rpc('get_item_share_activity', { p_inventory_id: inventoryId }),
    supabase.rpc('get_item_reservations', { p_inventory_id: inventoryId }),
  ]);

  if (itemRes.error || !itemRes.data) throw itemRes.error ?? new Error('Item not found');
  if (activityRes.error) throw activityRes.error;
  if (resvRes.error) throw resvRes.error;

  const photoRows = (photoRes.data ?? []) as PhotoRow[];
  // Public-read bucket → resized public URLs (800px/q80), no signing needed.
  const photoUrls: string[] = photoRows.map((p) => photoDetailUrl(p.storage_path));
  const photoPaths: string[] = photoRows.map((p) => p.storage_path);

  const fileRows = (fileRes.data ?? []) as { storage_path: string; original_name: string | null }[];
  let documents: InventoryDocument[] = [];
  if (fileRows.length > 0) {
    const { data: signed } = await supabase.storage
      .from('inventory-documents')
      .createSignedUrls(fileRows.map((f) => f.storage_path), SIGNED_TTL);
    const urlByPath = new Map<string, string>();
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
    documents = fileRows.map((f) => ({
      name: f.original_name ?? f.storage_path.split('/').pop() ?? 'Document',
      url: urlByPath.get(f.storage_path) ?? '',
      storage_path: f.storage_path,
    }));
  }

  return {
    item: itemRes.data as InventoryItem,
    photoUrls,
    photoPaths,
    documents,
    shareActivity: (activityRes.data ?? []) as ShareActivity[],
    reservations: (resvRes.data ?? []) as ItemReservation[],
  };
}

/**
 * Create an item: status='active', quantity_available=quantity, shared_count=0.
 * Returns its id. `provenance` is set only when the item is created by editing a
 * received share (records where the copy came from — owner-only, never shared).
 */
export async function createInventory(
  input: InventoryInput,
  provenance?: InventoryProvenance,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { data, error } = await supabase
    .from('inventory')
    .insert({
      vendor_id: user.id,
      title: input.title.trim(),
      product_code: input.productCode?.trim() || null,
      category: input.category ?? null,
      industry: input.industry ?? null,
      description: input.description?.trim() || null,
      quantity: input.quantity,
      quantity_available: input.quantity,
      unit: input.unit,
      currency: input.currency,
      price: input.price ?? null,
      origin: input.origin?.trim() || null,
      stock_location: input.stockLocation?.trim() || null,
      status: 'active',
      shared_count: 0,
      specs: {},
      edited_from_share_id: provenance?.editedFromShareId ?? null,
      edited_from_company: provenance?.editedFromCompany ?? null,
      edited_from_title: provenance?.editedFromTitle ?? null,
    })
    .select('inventory_id')
    .single();
  if (error || !data) throw error ?? new Error('Could not create item.');
  return (data as { inventory_id: string }).inventory_id;
}

/** Update an item. Adjusts quantity_available by the quantity delta to preserve reserved units. */
export async function updateInventory(inventoryId: string, input: InventoryInput): Promise<void> {
  const { data: cur, error: curErr } = await supabase
    .from('inventory')
    .select('quantity, quantity_available')
    .eq('inventory_id', inventoryId)
    .single();
  if (curErr || !cur) throw curErr ?? new Error('Item not found');

  const current = cur as { quantity: number; quantity_available: number };
  const reserved = current.quantity - current.quantity_available;
  const newAvailable = Math.max(input.quantity - reserved, 0);

  const { error } = await supabase
    .from('inventory')
    .update({
      title: input.title.trim(),
      product_code: input.productCode?.trim() || null,
      category: input.category ?? null,
      industry: input.industry ?? null,
      description: input.description?.trim() || null,
      quantity: input.quantity,
      quantity_available: newAvailable,
      unit: input.unit,
      currency: input.currency,
      price: input.price ?? null,
      origin: input.origin?.trim() || null,
      stock_location: input.stockLocation?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('inventory_id', inventoryId);
  if (error) throw error;
}

export async function archiveInventory(inventoryId: string): Promise<void> {
  const { error } = await supabase
    .from('inventory')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('inventory_id', inventoryId);
  if (error) throw error;
}

export async function deleteInventory(inventoryId: string): Promise<void> {
  const { error } = await supabase.from('inventory').delete().eq('inventory_id', inventoryId);
  if (error) {
    // FK from reservations has no cascade — surface a friendlier hint.
    throw new Error(
      'Could not delete — this item may have reservations. Archive it instead.',
    );
  }
}
