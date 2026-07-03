/**
 * Shared link-unfurl core for public share links.
 *
 * Used by two thin route wrappers:
 *   • /api/share/:token — the full share token.
 *   • /api/s/:code      — a compact short code that resolves to a token.
 *
 * Behaviour (identical for both once a token is known):
 *   • BOT   → 200 HTML carrying Open Graph / Twitter meta tags for the item.
 *   • HUMAN → 302 to the real signed-out landing page (/share/:token), which the
 *             SPA renders client-side.
 *
 * Share data comes from the anon-safe `get_public_share` RPC; nothing here
 * exposes the owner or any private field. og:image is the item's first product
 * photo via Supabase's image CDN; no photo → branded placeholder.
 */

export const BOT_KEYWORDS = [
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

export const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://gjpzgdrmfxiwqfijaizb.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcHpnZHJtZnhpd3FmaWphaXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Mzg4MzgsImV4cCI6MjA5NzUxNDgzOH0.03-PKq7f39r06cxLdePdcIn_ijp8uTwiHnF7lmJlcyw';
export const APP_BASE = (process.env.EXPO_PUBLIC_APP_URL ?? 'https://mystokk.vercel.app').replace(/\/+$/, '');
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

// Loosely-typed Vercel Node handler shapes (this file is excluded from tsconfig).
export interface ShareReq {
  method?: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
}
export interface ShareRes {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
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

/** Resolve a short code to its share token via the anon-safe RPC. */
export async function tokenForShortCode(code: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/token_for_short_code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_code: code }),
    });
    if (!res.ok) return null;
    const token = (await res.json()) as string | null;
    return typeof token === 'string' && token.length > 0 ? token : null;
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

/**
 * Lines under the product title:
 *   Shared by {company}
 *   {city}, {country}
 *   Powered by MyStokk
 * Parts omitted when absent. Never includes price.
 */
function buildDescription(share: PublicShare | null): string {
  if (!share) return 'View this shared item on MyStokk.';
  const location = [share.shared_by_city, share.shared_by_country].filter(Boolean).join(', ');
  const lines: string[] = [];
  lines.push(share.shared_by_company ? `Shared by ${share.shared_by_company}` : 'Shared on MyStokk');
  if (location) lines.push(location);
  lines.push('Powered by MyStokk');
  return lines.join('\n');
}

/** Spaced variant (leading blank line under the title) for the social preview. */
function buildOgDescription(share: PublicShare | null): string {
  return `\n${buildDescription(share)}`;
}

/** og:title is the product name only — the company appears below in the description. */
function buildTitle(share: PublicShare | null): string {
  return share?.title ?? 'Shared item on MyStokk';
}

const FALLBACK_OG_IMAGE = 'https://placehold.co/600x600/1e293b/ffffff?text=MyStokk';

function resolveOgImage(share: PublicShare | null): string {
  if (!share?.first_photo_path) return FALLBACK_OG_IMAGE;
  const path = share.first_photo_path.split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_URL}/storage/v1/render/image/public/${PHOTO_BUCKET}/${path}?width=600&height=600&resize=cover`;
}

function renderOgHtml(share: PublicShare | null, canonical: string, imageUrl: string): string {
  const title = escapeHtml(buildTitle(share));
  const description = escapeHtml(buildDescription(share));
  const ogDescription = escapeHtml(buildOgDescription(share));
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
<meta property="og:description" content="${ogDescription}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="600" />
<meta property="og:image:height" content="600" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="MyStokk" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${ogDescription}" />
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

/**
 * Full unfurl response for a KNOWN token: bot → OG HTML, human → 302 to the SPA
 * share landing. `token` must be non-empty (wrappers handle the missing case).
 *
 * `cacheable` controls the bot HTML's Cache-Control. It MUST be false for any
 * URL that both bots AND humans hit (e.g. /s/:code): Vercel's CDN keys only on
 * the URL (not User-Agent), so a cached 200 OG page would otherwise be served
 * to humans instead of their 302. When only bots reach the URL (/api/share via
 * the UA-conditional rewrite), caching is safe and worthwhile.
 */
export async function respondForToken(
  req: ShareReq,
  res: ShareRes,
  token: string,
  cacheable = true,
): Promise<void> {
  const ua = String(req.headers['user-agent'] ?? '').toLowerCase();
  const isBot = BOT_KEYWORDS.some((keyword) => ua.includes(keyword));
  const isHead = (req.method ?? 'GET').toUpperCase() === 'HEAD';
  const humanUrl = `${APP_BASE}/share/${encodeURIComponent(token)}`;
  const botCache = cacheable ? 'public, max-age=86400' : 'no-store';

  // Crawlers issue a HEAD before the GET — mirror the GET's status/headers, no body.
  if (isHead) {
    if (isBot) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', botCache);
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
  res.setHeader('Cache-Control', botCache);
  res.end(renderOgHtml(share, humanUrl, imageUrl));
}

/** 302 everyone to the app home — used when a token/code can't be resolved. */
export function redirectHome(res: ShareRes): void {
  res.statusCode = 302;
  res.setHeader('Location', APP_BASE);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}
