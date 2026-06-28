// ============================================================================
// send-email — Supabase Edge Function (Deno)
//
// Handles 4 email types via Resend (spec §3 + §6):
//   1. otp                — signup / reset 6-digit code (generated + stored here)
//   2. share_received     — share notification card
//   3. network_invite     — invite a non-vendor added via bulk CSV
//   4. reservation_update — accepted / rejected / countered
//
// Secrets (set via `supabase secrets set`, NEVER in the app .env):
//   RESEND_API_KEY, RESEND_FROM_EMAIL, PUBLIC_SHARE_BASE_URL (optional)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  sendEmail,
  buildOtpEmail,
  buildShareEmail,
  buildNetworkInviteEmail,
  buildReservationEmail,
  buildReservationRequestEmail,
  type ResendConfig,
  type SendEmailPayload,
} from '../../../src/services/email/resend.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Hardcoded on purpose: a stale PUBLIC_SHARE_BASE_URL secret (= app.mystokk.com)
// was overriding the default, so links kept opening the wrong domain. Pin it here.
const SHARE_BASE = 'https://mystokk.vercel.app';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const resendConfig: ResendConfig = {
  apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
  from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@yourdomain.com',
};

function generateOtp(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (100000 + (bytes[0] % 900000)).toString();
}

function formatPrice(price: number | null, currency: string | null): string {
  if (price === null || price === undefined) return 'Price on request';
  return `${currency ?? ''} ${price}`.trim();
}

// ---- type handlers ---------------------------------------------------------

async function handleOtp(p: Extract<SendEmailPayload, { type: 'otp' }>): Promise<Response> {
  const email = p.email.trim().toLowerCase();

  // Rate limit: max 3 codes per email per 10 minutes (spec §7).
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('otp_codes')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .eq('purpose', p.purpose)
    .gte('created_at', tenMinAgo);
  if ((count ?? 0) >= 3) {
    return json({ error: 'Too many codes requested. Try again in a few minutes.' }, 429);
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: insertError } = await supabase
    .from('otp_codes')
    .insert({ email, code, purpose: p.purpose, expires_at: expiresAt, used: false });
  if (insertError) throw insertError;

  const content = buildOtpEmail(p.purpose, code);
  await sendEmail(resendConfig, { to: email, ...content });
  return json({ ok: true });
}

async function handleShare(
  p: Extract<SendEmailPayload, { type: 'share_received' }>,
): Promise<Response> {
  // Most recent share of this item to this recipient → token, sender, override price.
  const { data: share } = await supabase
    .from('shares')
    .select('token, source_vendor_id, forward_price, forward_currency')
    .eq('inventory_id', p.inventoryId)
    .eq('recipient_id', p.recipientVendorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (!share) return json({ error: 'Share not found' }, 404);

  const [{ data: recipient }, { data: sender }, { data: item }] = await Promise.all([
    supabase.from('vendors').select('email').eq('id', p.recipientVendorId).single(),
    supabase.from('vendors').select('company_name').eq('id', share.source_vendor_id).single(),
    supabase.from('inventory').select('title, price, currency, stock_location').eq('inventory_id', p.inventoryId).single(),
  ]);
  if (!recipient?.email || !item) return json({ error: 'Recipient or item missing' }, 404);

  // Signed URL for the first photo (private bucket) — fall back to plain text if none.
  let photoUrl: string | null = null;
  const { data: photo } = await supabase
    .from('inventory_photos')
    .select('storage_path')
    .eq('inventory_id', p.inventoryId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (photo?.storage_path) {
    const { data: signed } = await supabase.storage
      .from('inventory-photos')
      .createSignedUrl(photo.storage_path, 60 * 60 * 24);
    photoUrl = signed?.signedUrl ?? null;
  }

  const content = buildShareEmail({
    senderCompany: sender?.company_name ?? 'A MyStokk vendor',
    productTitle: item.title,
    priceLabel: formatPrice(share.forward_price ?? item.price, share.forward_currency ?? item.currency),
    stockLocation: item.stock_location ?? null,
    shareUrl: `${SHARE_BASE}/share/${share.token}`,
    photoUrl,
  });
  await sendEmail(resendConfig, { to: recipient.email, ...content });
  return json({ ok: true });
}

async function handleInvite(
  p: Extract<SendEmailPayload, { type: 'network_invite' }>,
): Promise<Response> {
  const { data: inviter } = await supabase
    .from('vendors')
    .select('company_name')
    .eq('id', p.inviterVendorId)
    .single();

  const content = buildNetworkInviteEmail({
    inviterCompany: inviter?.company_name ?? 'A MyStokk vendor',
    signupUrl: `${SHARE_BASE}/signup`,
  });
  await sendEmail(resendConfig, { to: p.email.trim().toLowerCase(), ...content });
  return json({ ok: true });
}

async function handleReservationRequest(
  p: Extract<SendEmailPayload, { type: 'reservation_request' }>,
): Promise<Response> {
  const { data: res } = await supabase
    .from('reservations')
    .select('inventory_id, requester_id, responder_id, quantity, offered_price')
    .eq('reservation_id', p.reservationId)
    .single();
  if (!res) return json({ error: 'Reservation not found' }, 404);

  const [{ data: responder }, { data: requester }, { data: item }] = await Promise.all([
    supabase.from('vendors').select('email').eq('id', res.responder_id).single(),
    supabase.from('vendors').select('company_name').eq('id', res.requester_id).single(),
    supabase.from('inventory').select('title, currency').eq('inventory_id', res.inventory_id).single(),
  ]);
  if (!responder?.email || !item) return json({ error: 'Responder or item missing' }, 404);

  const content = buildReservationRequestEmail({
    requesterCompany: requester?.company_name ?? 'A MyStokk vendor',
    productTitle: item.title,
    quantityLabel: `${res.quantity} ${''}`.trim(),
    offerLabel:
      res.offered_price !== null && res.offered_price !== undefined
        ? `Offer: ${formatPrice(res.offered_price, item.currency)}`
        : null,
    message: null,
    actionUrl: `${SHARE_BASE}/reservations/${p.reservationId}`,
  });
  await sendEmail(resendConfig, { to: responder.email, ...content });
  return json({ ok: true });
}

async function handleReservation(
  p: Extract<SendEmailPayload, { type: 'reservation_update' }>,
): Promise<Response> {
  const { data: res } = await supabase
    .from('reservations')
    .select('inventory_id, requester_id, responder_id')
    .eq('reservation_id', p.reservationId)
    .single();
  if (!res) return json({ error: 'Reservation not found' }, 404);

  const [{ data: buyer }, { data: responder }, { data: item }] = await Promise.all([
    supabase.from('vendors').select('email').eq('id', res.requester_id).single(),
    supabase.from('vendors').select('company_name').eq('id', res.responder_id).single(),
    supabase.from('inventory').select('title').eq('inventory_id', res.inventory_id).single(),
  ]);
  if (!buyer?.email || !item) return json({ error: 'Buyer or item missing' }, 404);

  const content = buildReservationEmail({
    status: p.status,
    productTitle: item.title,
    responderCompany: responder?.company_name ?? 'The seller',
    actionUrl: `${SHARE_BASE}/reservations/${p.reservationId}`,
  });
  await sendEmail(resendConfig, { to: buyer.email, ...content });
  return json({ ok: true });
}

// ---- entrypoint ------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const payload = (await req.json()) as SendEmailPayload;
    switch (payload.type) {
      case 'otp':
        return await handleOtp(payload);
      case 'share_received':
        return await handleShare(payload);
      case 'network_invite':
        return await handleInvite(payload);
      case 'reservation_request':
        return await handleReservationRequest(payload);
      case 'reservation_update':
        return await handleReservation(payload);
      default:
        return json({ error: 'Unknown email type' }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return json({ error: message }, 500);
  }
});
