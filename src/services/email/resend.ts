/**
 * Resend email service — SERVER-SIDE ONLY.
 *
 * This module is imported by the `send-email` Supabase Edge Function (Deno).
 * It must NEVER be imported into the mobile app bundle: the Resend API key is
 * an Edge Function secret and may not ship to the client (spec §7).
 *
 * It is intentionally environment-agnostic — it takes the API key + from-address
 * as parameters and uses the global `fetch`, so it runs under Deno (the Edge
 * Function) without pulling in any React Native or Deno-specific globals.
 *
 * Colours below mirror src/theme/tokens.ts. They are inlined (not imported)
 * because email HTML requires literal inline styles and to keep this module a
 * single self-contained file for the Deno bundler.
 */

const BRAND = {
  navy: '#0F172A',
  emerald: '#059669',
  amber: '#D97706',
  red: '#DC2626',
  blue: '#2563EB',
  slate700: '#334155',
  slate500: '#64748B',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
} as const;

export interface ResendConfig {
  apiKey: string;
  from: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/** The discriminated payload the Edge Function accepts. Shared with callers. */
export type SendEmailPayload =
  | { type: 'otp'; purpose: 'signup' | 'reset'; email: string }
  | { type: 'share_received'; recipientVendorId: string; inventoryId: string }
  | { type: 'network_invite'; email: string; inviterVendorId: string }
  | { type: 'reservation_request'; reservationId: string }
  | {
      type: 'reservation_update';
      reservationId: string;
      status: 'accepted' | 'rejected' | 'countered';
    };

/** POST a single email to the Resend REST API. Throws on a non-2xx response. */
export async function sendEmail(config: ResendConfig, message: EmailMessage): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      from: config.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend send failed (${response.status}): ${detail}`);
  }
}

// ----------------------------------------------------------------------------
// Shared HTML layout
// ----------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(innerHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:${BRAND.slate100};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.slate100};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BRAND.slate200};">
        <tr><td style="background:${BRAND.navy};padding:20px 28px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">MyStokk</span>
        </td></tr>
        <tr><td style="padding:28px;color:${BRAND.slate700};font-size:15px;line-height:1.55;">
          ${innerHtml}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid ${BRAND.slate200};color:${BRAND.slate500};font-size:12px;">
          You're receiving this because you have a MyStokk account or were invited to one.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(label: string, url: string, color: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr><td style="border-radius:10px;background:${color};">
      <a href="${url}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">${label}</a>
    </td></tr></table>`;
}

// ----------------------------------------------------------------------------
// 1. OTP verification (signup + reset)
// ----------------------------------------------------------------------------

export function buildOtpEmail(purpose: 'signup' | 'reset', code: string): EmailContent {
  const heading = purpose === 'signup' ? 'Confirm your email' : 'Reset your password';
  const intro =
    purpose === 'signup'
      ? 'Welcome to MyStokk. Use the code below to verify your email and finish creating your account.'
      : 'Use the code below to reset your MyStokk password.';

  const html = layout(`
    <h1 style="margin:0 0 12px;font-size:20px;color:${BRAND.navy};">${heading}</h1>
    <p style="margin:0 0 18px;">${intro}</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:${BRAND.navy};background:${BRAND.slate50};border:1px solid ${BRAND.slate200};border-radius:12px;padding:18px;text-align:center;">${code}</div>
    <p style="margin:18px 0 0;color:${BRAND.slate500};font-size:13px;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
  `);

  const text = `${heading}\n\n${intro}\n\nYour code: ${code}\n\nThis code expires in 10 minutes.`;
  return { subject: `${code} is your MyStokk ${purpose === 'signup' ? 'verification' : 'reset'} code`, html, text };
}

// ----------------------------------------------------------------------------
// 2. Share notification
// ----------------------------------------------------------------------------

export interface ShareEmailParams {
  senderCompany: string;
  productTitle: string;
  priceLabel: string;
  shareUrl: string;
  photoUrl: string | null;
}

export function buildShareEmail(params: ShareEmailParams): EmailContent {
  const { senderCompany, productTitle, priceLabel, shareUrl, photoUrl } = params;
  const safeTitle = escapeHtml(productTitle);
  const safeCompany = escapeHtml(senderCompany);

  const photoBlock =
    photoUrl !== null
      ? `<img src="${photoUrl}" alt="${safeTitle}" width="424" style="width:100%;max-width:424px;height:auto;border-radius:10px;border:1px solid ${BRAND.slate200};margin-bottom:16px;" />`
      : '';

  const html = layout(`
    <p style="margin:0 0 4px;color:${BRAND.slate500};font-size:13px;">${safeCompany} shared an item with you</p>
    ${photoBlock}
    <h1 style="margin:0 0 6px;font-size:20px;color:${BRAND.navy};">${safeTitle}</h1>
    <p style="margin:0 0 2px;font-size:18px;font-weight:700;color:${BRAND.emerald};">${escapeHtml(priceLabel)}</p>
    <p style="margin:6px 0 0;color:${BRAND.slate500};font-size:13px;">Shared by ${safeCompany}</p>
    ${button('View item', shareUrl, BRAND.emerald)}
  `);

  // Plain-text fallback (also used when there is no photo).
  const text = `${senderCompany} shared an item with you on MyStokk.\n\n${productTitle}\n${priceLabel}\nShared by ${senderCompany}\n\nView it: ${shareUrl}`;

  return { subject: `${senderCompany} shared "${productTitle}" with you`, html, text };
}

// ----------------------------------------------------------------------------
// 3. Network invite
// ----------------------------------------------------------------------------

export interface NetworkInviteParams {
  inviterCompany: string;
  signupUrl: string;
}

export function buildNetworkInviteEmail(params: NetworkInviteParams): EmailContent {
  const safeCompany = escapeHtml(params.inviterCompany);
  const html = layout(`
    <h1 style="margin:0 0 12px;font-size:20px;color:${BRAND.navy};">${safeCompany} invited you to MyStokk</h1>
    <p style="margin:0 0 6px;">${safeCompany} wants to share live stock with you privately on MyStokk — a B2B platform for trading and distribution businesses.</p>
    <p style="margin:0 0 6px;color:${BRAND.slate500};font-size:13px;">Create your free account to see what they've shared and start reserving, negotiating, and forwarding offers.</p>
    ${button('Join MyStokk', params.signupUrl, BRAND.navy)}
  `);
  const text = `${params.inviterCompany} invited you to MyStokk.\n\nCreate your free account to see what they've shared: ${params.signupUrl}`;
  return { subject: `${params.inviterCompany} invited you to MyStokk`, html, text };
}

// ----------------------------------------------------------------------------
// 4a. Reservation request (to the seller)
// ----------------------------------------------------------------------------

export interface ReservationRequestParams {
  requesterCompany: string;
  productTitle: string;
  quantityLabel: string;
  offerLabel: string | null;
  message: string | null;
  actionUrl: string;
}

export function buildReservationRequestEmail(params: ReservationRequestParams): EmailContent {
  const { requesterCompany, productTitle, quantityLabel, offerLabel, message, actionUrl } = params;
  const safeTitle = escapeHtml(productTitle);
  const safeCompany = escapeHtml(requesterCompany);

  const offerBlock = offerLabel
    ? `<p style="margin:0 0 4px;font-size:18px;font-weight:700;color:${BRAND.emerald};">${escapeHtml(offerLabel)}</p>`
    : `<p style="margin:0 0 4px;color:${BRAND.slate500};font-size:13px;">Accepting your listed price</p>`;
  const messageBlock = message
    ? `<p style="margin:12px 0 0;padding:10px 12px;background:${BRAND.slate50};border-radius:8px;color:${BRAND.slate700};font-size:13px;">"${escapeHtml(message)}"</p>`
    : '';

  const html = layout(`
    <p style="margin:0 0 4px;color:${BRAND.slate500};font-size:13px;">New reservation request</p>
    <h1 style="margin:0 0 6px;font-size:20px;color:${BRAND.navy};">${safeTitle}</h1>
    <p style="margin:0 0 8px;">${safeCompany} wants to reserve <strong>${escapeHtml(quantityLabel)}</strong>.</p>
    ${offerBlock}
    ${messageBlock}
    ${button('Review request', actionUrl, BRAND.emerald)}
  `);
  const text = `New reservation request: ${productTitle}\n\n${requesterCompany} wants to reserve ${quantityLabel}.\n${
    offerLabel ?? 'Accepting your listed price'
  }${message ? `\n\n"${message}"` : ''}\n\nReview it: ${actionUrl}`;

  return { subject: `${requesterCompany} wants to reserve "${productTitle}"`, html, text };
}

// ----------------------------------------------------------------------------
// 4. Reservation status update
// ----------------------------------------------------------------------------

export interface ReservationEmailParams {
  status: 'accepted' | 'rejected' | 'countered';
  productTitle: string;
  responderCompany: string;
  actionUrl: string;
}

export function buildReservationEmail(params: ReservationEmailParams): EmailContent {
  const { status, productTitle, responderCompany, actionUrl } = params;
  const safeTitle = escapeHtml(productTitle);
  const safeCompany = escapeHtml(responderCompany);

  const map = {
    accepted: { word: 'accepted', color: BRAND.emerald, line: 'Your reservation was accepted.' },
    rejected: { word: 'rejected', color: BRAND.red, line: 'Your reservation was rejected.' },
    countered: { word: 'countered', color: BRAND.blue, line: 'You received a counter-offer.' },
  } as const;
  const m = map[status];

  const html = layout(`
    <p style="margin:0 0 4px;color:${BRAND.slate500};font-size:13px;">Reservation update</p>
    <h1 style="margin:0 0 6px;font-size:20px;color:${BRAND.navy};">${safeTitle}</h1>
    <p style="margin:0 0 6px;display:inline-block;padding:6px 12px;border-radius:999px;background:${m.color};color:#ffffff;font-size:13px;font-weight:600;text-transform:capitalize;">${m.word}</p>
    <p style="margin:14px 0 0;">${m.line} — from ${safeCompany}.</p>
    ${button('Open reservation', actionUrl, m.color)}
  `);
  const text = `Reservation update: ${productTitle}\n\n${m.line} (from ${responderCompany})\n\nOpen it: ${actionUrl}`;
  return { subject: `Your reservation for "${productTitle}" was ${m.word}`, html, text };
}
