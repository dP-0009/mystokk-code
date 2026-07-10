// ============================================================================
// public-doc — Supabase Edge Function (Deno)
//
// Mints a short-lived signed URL for one document of a publicly-shared item, so
// the login-free share landing page can offer the packing list / spec sheets.
//
// The inventory-documents bucket is PRIVATE and stays that way: nothing here
// loosens storage RLS. Instead the caller must present a share token, and the
// function (service role) verifies, before signing:
//   1. the token belongs to an ACTIVE share, and
//   2. the requested storage_path is a document of THAT share's inventory.
// A caller who knows a path but not a live token gets nothing, and revoking the
// share immediately kills document access.
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// Deployed with verify_jwt=true — the anon key satisfies it, so signed-out
// visitors can call it, but random internet traffic cannot.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DOCS_BUCKET = 'inventory-documents';
const SIGNED_URL_TTL = 300; // 5 minutes — long enough to click, short enough to not leak

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let token: unknown;
  let path: unknown;
  try {
    ({ token, path } = await req.json());
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (typeof token !== 'string' || typeof path !== 'string' || !token || !path) {
    return json({ error: 'token and path are required' }, 400);
  }

  const { data: share } = await supabase
    .from('shares')
    .select('inventory_id')
    .eq('token', token)
    .eq('status', 'active')
    .maybeSingle();
  if (!share) return json({ error: 'Share not found' }, 404);

  // The path must belong to this share's inventory — never sign an arbitrary path.
  const { data: file } = await supabase
    .from('inventory_files')
    .select('storage_path')
    .eq('inventory_id', share.inventory_id)
    .eq('storage_path', path)
    .maybeSingle();
  if (!file) return json({ error: 'Document not found' }, 404);

  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data) return json({ error: 'Could not sign document' }, 500);

  return json({ url: data.signedUrl });
});
