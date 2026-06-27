/**
 * GET /api/share/:token — link-unfurl shim for public share links.
 *
 * Social crawlers (WhatsApp, Slack, etc.) don't run JS, so the static SPA can't
 * give them a useful preview. This endpoint sniffs the User-Agent:
 *   • BOT   → 200 HTML carrying Open Graph / Twitter meta tags for the item.
 *   • HUMAN → 302 to the real signed-out landing page (/share/:token), which the
 *             SPA renders client-side.
 *
 * Share data comes from the same anon-safe `get_public_share` RPC the app uses,
 * so nothing here exposes the owner or any private field. og:image is the item's
 * first product photo: the private photo is signed (service key) and routed
 * through /api/public-files for a 1200x630 JPEG; no photo → branded placeholder.
 *
 * NOTE: the spec asked to redirect humans to /shared/:share_id, but that route
 * doesn't exist and the public RPC deliberately never returns share_id. The
 * working human target is /share/:token (the ShareLanding screen).
 */

// Crawlers that should receive the meta-tag HTML instead of a redirect.
const BOT_KEYWORDS = [
  'whatsapp',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'telegrambot',
  'slackbot',
  'discordbot',
  'googlebot',
  'bingbot',
  'applebot',
  'pinterest',
];

// Public, client-safe values (identical to what ships in the web bundle). Env
// overrides win so this still works if the project configures them in Vercel.
const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://gjpzgdrmfxiwqfijaizb.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcHpnZHJtZnhpd3FmaWphaXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzg4MzgsImV4cCI6MjA5NzUxNDgzOH0.03-PKq7f39r06cxLdePdcIn_ijp8uTwiHnF7lmJlcyw';
const APP_BASE = (process.env.EXPO_PUBLIC_APP_URL ?? 'https://mystokk.vercel.app').replace(/\/+$/, '');
const PHOTO_BUCKET = 'inventory-photos';

interface PublicShare {
  title: string;
  description: string | null;
  category: string | null;
  quantity: number;
  unit: string;
  origin: string | null;
  display_price: number | null;
  display_currency: string | null;
  forward_remark: string | null;
  shared_by_company: string | null;
  shared_by_logo_url: string | null;
  shared_by_city: string | null;
  shared_by_country: string | null;
  first_photo_path: string | null;
}

/** Calls the anon-safe RPC over PostgREST; returns null on miss/error. */
async function fetchPublicShare(token: string): Promise<PublicShare | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_token: token }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as PublicShare[];
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "{qty} {unit} from {company} • {city}, {country} • Powered by MyStokk" — parts omitted when absent. Never includes price. */
function buildDescription(share: PublicShare | null): string {
  if (!share) return 'View this shared item on MyStokk.';
  const qty = `${share.quantity.toLocaleString('en-US')} ${share.unit}`.trim();
  const fromCompany = share.shared_by_company ? `${qty} from ${share.shared_by_company}` : qty;
  const location = [share.shared_by_city, share.shared_by_country].filter(Boolean).join(', ');
  return [fromCompany, location, 'Powered by MyStokk'].filter(Boolean).join(' • ');
}

/**
 * og:title carries the company name (og:description is plain text, so the
 * company emphasis lives here): "{item_title} — {company_name}".
 */
function buildTitle(share: PublicShare | null): string {
  const title = share?.title ?? 'Shared item on MyStokk';
  return share?.shared_by_company ? `${title} — ${share.shared_by_company}` : title;
}

/** No product photo on the item → branded placeholder card. */
const FALLBACK_OG_IMAGE = 'https://placehold.co/1200x630/1e293b/ffffff?text=MyStokk+Stock+Update';

/**
 * og:image is the item's FIRST product photo. The inventory-photos bucket is
 * public-read (migration 032), so we point straight at the photo's public path
 * through /api/public-files, which returns a crawler-safe 1200x630 JPEG. No
 * service key or signing needed. No photo → branded placeholder.
 */
function resolveOgImage(share: PublicShare | null): string {
  if (!share?.first_photo_path) return FALLBACK_OG_IMAGE;
  const path = share.first_photo_path.split('/').map(encodeURIComponent).join('/');
  return `${APP_BASE}/api/public-files/${PHOTO_BUCKET}/${path}?convert=jpeg`;
}

function renderOgHtml(share: PublicShare | null, canonical: string, imageUrl: string): string {
  const title = escapeHtml(buildTitle(share));
  const description = escapeHtml(buildDescription(share));
  const image = escapeHtml(imageUrl);
  const url = escapeHtml(canonical);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="MyStokk" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
<link rel="canonical" href="${url}" />
<!-- Meta refresh as fallback for humans who land here -->
<meta http-equiv="refresh" content="1;url=${url}" />
</head>
<body>
<p>${title}</p>
<p><a href="${url}">Open on MyStokk</a></p>
</body>
</html>`;
}

// Vercel Node serverless handler. Typed loosely to avoid a build-time dependency
// on @vercel/node; this file is excluded from the app's tsconfig.
export default async function handler(
  req: {
    method?: string;
    query: Record<string, string | string[]>;
    headers: Record<string, string | string[] | undefined>;
  },
  res: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (body?: string) => void;
  },
): Promise<void> {
  const rawToken = req.query.token;
  const token = String(Array.isArray(rawToken) ? rawToken[0] : rawToken ?? '');
  const ua = String(req.headers['user-agent'] ?? '').toLowerCase();
  const isBot = BOT_KEYWORDS.some((keyword) => ua.includes(keyword));
  const isHead = (req.method ?? 'GET').toUpperCase() === 'HEAD';

  const humanUrl = `${APP_BASE}/share/${encodeURIComponent(token)}`;

  if (!token) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(isHead ? undefined : 'Missing share token.');
    return;
  }

  // WhatsApp (and other crawlers) issue a HEAD before the GET — answer with the
  // same headers/status the GET would produce, but no body.
  if (isHead) {
    if (isBot) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
      res.statusCode = 302;
      res.setHeader('Location', humanUrl);
      res.setHeader('Cache-Control', 'no-store');
    }
    res.end();
    return;
  }

  if (!isBot) {
    res.statusCode = 302;
    res.setHeader('Location', humanUrl);
    res.setHeader('Cache-Control', 'no-store');
    res.end();
    return;
  }

  const share = await fetchPublicShare(token);
  const imageUrl = resolveOgImage(share);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.end(renderOgHtml(share, humanUrl, imageUrl));
}
