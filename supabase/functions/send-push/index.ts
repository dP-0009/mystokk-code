// ============================================================================
// send-push — Supabase Edge Function (Deno)
//
// Invoked by the notifications_push database webhook (migration 024) on every
// INSERT into public.notifications. Looks up the recipient vendor's FCM token
// and delivers a push via the FCM HTTP v1 API. The push carries a `data`
// payload ({ type, related_id }) the app uses to deep-link.
//
// Secrets (set via `supabase secrets set`):
//   FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY   (Firebase service account)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Deployed with verify_jwt=false (DB-webhook pattern). If the FCM secrets are
// absent it no-ops with 200 so notification writes never fail.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID') ?? '';
const FCM_CLIENT_EMAIL = Deno.env.get('FCM_CLIENT_EMAIL') ?? '';
const FCM_PRIVATE_KEY = (Deno.env.get('FCM_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n');

// ---- Google service-account OAuth (sign a JWT, exchange for an access token) ----

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: FCM_CLIENT_EMAIL,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(FCM_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const jwt = `${unsigned}.${base64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

interface NotificationPayload {
  vendor_id: string;
  type: string;
  title: string;
  body?: string | null;
  related_id?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const n = (await req.json()) as NotificationPayload;
    if (!n?.vendor_id) return json({ error: 'Missing vendor_id' }, 400);

    const { data: vendor } = await supabase
      .from('vendors')
      .select('push_token')
      .eq('id', n.vendor_id)
      .single();

    if (!vendor?.push_token) return json({ ok: true, skipped: 'no push token' });
    if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
      return json({ ok: true, skipped: 'FCM not configured' });
    }

    const accessToken = await getAccessToken();
    const message = {
      message: {
        token: vendor.push_token,
        notification: { title: n.title, body: n.body ?? '' },
        // data must be string→string; the app reads these to deep-link.
        data: { type: String(n.type ?? ''), related_id: String(n.related_id ?? '') },
        android: { priority: 'HIGH' },
        apns: { payload: { aps: { sound: 'default' } } },
      },
    };

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    const result = await res.json();

    // A stale token (UNREGISTERED) → clear it so we stop trying.
    if (!res.ok) {
      const status = result?.error?.details?.[0]?.errorCode ?? result?.error?.status;
      if (status === 'UNREGISTERED' || status === 'NOT_FOUND') {
        await supabase.from('vendors').update({ push_token: null }).eq('id', n.vendor_id);
      }
      return json({ error: 'FCM send failed', detail: result }, 502);
    }
    return json({ ok: true, fcm: result });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
