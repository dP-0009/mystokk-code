import { supabase } from './client';
import type { NetworkVendor } from './network';

/**
 * Sharing service (Build Guide Step 21 / Spec §6.1).
 *
 * Direct shares, email shares and public links all funnel through migration 014
 * RPCs so notifications (for OTHER vendors) and shared_count stay correct and
 * atomic. Public links are a plain client insert (recipient_id = null) — the
 * shares_manage_own RLS policy already permits that for the owner.
 */

/**
 * Public base URL for share links. Driven by EXPO_PUBLIC_APP_URL so the host can
 * change per environment (Expo inlines EXPO_PUBLIC_* into the bundle at build).
 * Falls back to the current web deployment. Trailing slashes are trimmed so
 * `shareUrl()` never produces a double slash.
 */
export const SHARE_BASE = (
  process.env.EXPO_PUBLIC_APP_URL ?? 'https://mystokk.vercel.app'
).replace(/\/+$/, '');

export function shareUrl(token: string): string {
  // Point straight at the OG endpoint so social crawlers (WhatsApp, etc.) always
  // get the rich preview + image; the endpoint 302-redirects humans to the SPA
  // share landing. This is more reliable than relying on a user-agent rewrite.
  return `${SHARE_BASE}/api/share/${token}`;
}

export interface PublicShare {
  token: string;
  chain_depth: number;
  status: string;
  title: string;
  description: string | null;
  category: string | null;
  quantity: number;
  unit: string;
  origin: string | null;
  stock_location: string | null;
  display_price: number | null;
  display_currency: string | null;
  forward_remark: string | null;
  shared_by_company: string | null;
  shared_by_logo_url: string | null;
  /** Storage path of the item's first photo (inventory-photos bucket), or null. */
  first_photo_path: string | null;
  has_recipient: boolean;
}

/**
 * Public URL for a product photo on the share landing page. The inventory-photos
 * bucket is public-read (migration 032), so this needs no auth.
 *
 * NOTE: uses the PLAIN public object URL, not the image-transform CDN variant —
 * Supabase image transformations are a paid add-on and 404 when not enabled,
 * which left the landing page showing a blank dark box. The plain URL always
 * loads from the public bucket.
 */
export function publicPhotoUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  return supabase.storage.from('inventory-photos').getPublicUrl(storagePath).data.publicUrl;
}

export interface ShareResult {
  created: number; // new direct shares to registered vendors
  invited: number; // unregistered contacts invited by email
}

/**
 * Share an item with selected network vendors. Registered vendors get a direct
 * shares row (batched RPC); unregistered manual contacts with an email get an
 * invite. shared_count is incremented only by genuinely new recipients (RPC).
 */
export async function shareToNetwork(inventoryId: string, vendors: NetworkVendor[]): Promise<ShareResult> {
  const registeredIds = vendors
    .map((v) => v.vendor_id)
    .filter((id): id is string => Boolean(id));

  let created = 0;
  if (registeredIds.length > 0) {
    const { data, error } = await supabase.rpc('create_direct_shares', {
      p_inventory_id: inventoryId,
      p_recipient_ids: registeredIds,
    });
    if (error) throw error;
    created = (data as number) ?? 0;
    // Fire notification emails — best-effort, never block the share.
    await Promise.allSettled(
      registeredIds.map((rid) =>
        supabase.functions.invoke('send-email', {
          body: { type: 'share_received', recipientVendorId: rid, inventoryId },
        }),
      ),
    );
  }

  // Unregistered manual contacts → invite by email.
  const inviteEmails = vendors.filter((v) => !v.vendor_id && v.email).map((v) => v.email as string);
  let invited = 0;
  for (const email of inviteEmails) {
    try {
      await shareSingleEmail(inventoryId, email);
      invited += 1;
    } catch {
      // skip a failed invite; continue the rest
    }
  }

  return { created, invited };
}

/**
 * Share with a single email address. Matches a registered vendor → direct
 * share; otherwise records a manual reference + a claimable public link, and
 * sends an invite email. Returns whether the email matched a vendor.
 */
export async function shareSingleEmail(inventoryId: string, email: string): Promise<{ matched: boolean }> {
  const { data, error } = await supabase.rpc('share_by_email', {
    p_inventory_id: inventoryId,
    p_email: email,
  });
  if (error) throw error;
  const res = data as { matched: boolean; token: string | null; recipient_id: string | null };

  // Best-effort email delivery. Registered or not, the recipient gets the same
  // item card so they see the actual shared item (not a bare invite). For an
  // unregistered email we hand the Edge Function the claimable share token.
  try {
    if (res.matched && res.recipient_id) {
      await supabase.functions.invoke('send-email', {
        body: { type: 'share_received', recipientVendorId: res.recipient_id, inventoryId },
      });
    } else if (res.token) {
      await supabase.functions.invoke('send-email', {
        body: { type: 'share_received', inventoryId, token: res.token, email },
      });
    }
  } catch {
    // notification email is non-critical
  }
  return { matched: res.matched };
}

/** Create a public-forward link (recipient_id = null) and return its token + URL. */
export async function createPublicLink(inventoryId: string): Promise<{ token: string; url: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { data, error } = await supabase
    .from('shares')
    .insert({
      inventory_id: inventoryId,
      original_owner_id: user.id,
      source_vendor_id: user.id,
      recipient_id: null,
      parent_share_id: null,
      chain_depth: 0,
    })
    .select('token')
    .single();
  if (error || !data) throw error ?? new Error('Could not create link.');
  const token = (data as { token: string }).token;
  return { token, url: shareUrl(token) };
}

/** Login-free preview of a share by token (anon-safe; never exposes the owner). */
export async function getPublicShare(token: string): Promise<PublicShare | null> {
  const { data, error } = await supabase.rpc('get_public_share', { p_token: token });
  if (error) throw error;
  return ((data ?? []) as PublicShare[])[0] ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// Forward flow — a recipient (B) re-shares a received item downstream (to C).
// original_owner_id is copied from the parent server-side; the downstream
// recipient only ever sees B as the sharer. Forwards never touch shared_count.
// ────────────────────────────────────────────────────────────────────────────

export interface ForwardContext {
  parentShareId: string;
  price: number | null;
  currency: string;
  remark: string | null;
}

/** Forward a received share to selected network vendors (+ email invites). */
export async function forwardToNetwork(
  ctx: ForwardContext,
  vendors: NetworkVendor[],
  inventoryId?: string,
): Promise<ShareResult> {
  const registeredIds = vendors.map((v) => v.vendor_id).filter((id): id is string => Boolean(id));

  let created = 0;
  if (registeredIds.length > 0) {
    const { data, error } = await supabase.rpc('create_forward_shares', {
      p_parent_share_id: ctx.parentShareId,
      p_recipient_ids: registeredIds,
      p_forward_price: ctx.price,
      p_forward_currency: ctx.currency,
      p_forward_remark: ctx.remark,
    });
    if (error) throw error;
    created = (data as number) ?? 0;
    // In-app notifications are created by the RPC; downstream notification email
    // is sent by the recipient's own client flow (no inventoryId available here).
  }

  const inviteEmails = vendors.filter((v) => !v.vendor_id && v.email).map((v) => v.email as string);
  let invited = 0;
  for (const email of inviteEmails) {
    try {
      await forwardByEmail(ctx, email, inventoryId);
      invited += 1;
    } catch {
      // skip a failed invite
    }
  }
  return { created, invited };
}

/**
 * Forward a received share to a single email address. Also fires the branded
 * "share_received" notification email (same rich card a direct share sends), so
 * emailing a contact never falls back to a plain client-composed message. The
 * email is best-effort and needs the item's `inventoryId` to build the card.
 */
export async function forwardByEmail(
  ctx: ForwardContext,
  email: string,
  inventoryId?: string,
): Promise<{ matched: boolean }> {
  const { data, error } = await supabase.rpc('forward_by_email', {
    p_parent_share_id: ctx.parentShareId,
    p_email: email,
    p_forward_price: ctx.price,
    p_forward_currency: ctx.currency,
    p_forward_remark: ctx.remark,
  });
  if (error) throw error;
  const res = data as { matched: boolean; token: string | null };

  // Branded email via the same Edge Function path as a direct share (non-critical).
  try {
    if (inventoryId && res.token) {
      await supabase.functions.invoke('send-email', {
        body: { type: 'share_received', inventoryId, token: res.token, email },
      });
    }
  } catch {
    // notification email is non-critical
  }
  return { matched: res.matched };
}

/** Create a public forward link carrying the forwarder's price/remark. */
export async function createForwardLink(ctx: ForwardContext): Promise<{ token: string; url: string }> {
  const { data, error } = await supabase.rpc('create_forward_link', {
    p_parent_share_id: ctx.parentShareId,
    p_forward_price: ctx.price,
    p_forward_currency: ctx.currency,
    p_forward_remark: ctx.remark,
  });
  if (error) throw error;
  const token = data as string;
  return { token, url: shareUrl(token) };
}

/** Signed-in resolution: claims a public link (recipient → me) or flags ownership. */
export async function claimShare(
  token: string,
): Promise<{ is_owner: boolean; share_id: string; inventory_id: string }> {
  const { data, error } = await supabase.rpc('claim_share', { p_token: token });
  if (error) throw error;
  return data as { is_owner: boolean; share_id: string; inventory_id: string };
}

export interface DirectShare {
  share_id: string;
  recipient_id: string | null;
  recipient_company: string | null; // null → public-forward link
  recipient_email: string | null; // recipient vendor's email (null for public links)
  token: string;
  status: string; // 'active' | 'revoked'
  created_at: string;
}

/** Every direct (chain_depth=0) share the owner created for an item. */
export async function getItemDirectShares(inventoryId: string): Promise<DirectShare[]> {
  const { data, error } = await supabase.rpc('get_item_direct_shares', { p_inventory_id: inventoryId });
  if (error) throw error;
  return (data ?? []) as DirectShare[];
}

/**
 * The forwards the CURRENT user made from a received share (downstream of
 * `parentShareId`). Privacy-scoped server-side to the caller's own forwards, so
 * a recipient only ever sees who THEY forwarded to — never the upstream owner's
 * or any other forwarder's recipients. Same row shape as a direct share.
 */
export async function getForwardShares(parentShareId: string): Promise<DirectShare[]> {
  const { data, error } = await supabase.rpc('get_forward_shares', { p_parent_share_id: parentShareId });
  if (error) throw error;
  return (data ?? []) as DirectShare[];
}

/** Revoke a share; cascades to all downstream forwards. Returns shares revoked. */
export async function revokeShare(shareId: string): Promise<number> {
  const { data, error } = await supabase.rpc('revoke_share', { p_share_id: shareId });
  if (error) throw error;
  return (data as number) ?? 0;
}

export interface ResolvedShare {
  found: boolean;
  is_owner?: boolean;
  inventory_id?: string;
  share_id?: string;
  cleaned?: boolean;
}

/**
 * Owner self-share protection (Spec §7.6). Resolves a token WITHOUT claiming:
 * flags whether the caller owns the listing (id = original_owner_id OR
 * source_vendor_id) and auto-deletes a bogus self-share if encountered.
 */
export async function resolveShareToken(token: string): Promise<ResolvedShare> {
  const { data, error } = await supabase.rpc('resolve_share_token', { p_token: token });
  if (error) throw error;
  return data as ResolvedShare;
}
