// ============================================================================
// reset-password — Supabase Edge Function (Deno)
//
// Completes the password-reset flow (spec §3.3). The user is logged OUT during
// reset, so verification + the password change must run server-side with the
// service role — a logged-out client cannot call supabase.auth.updateUser.
//
// Flow:
//   1. Verify the 6-digit OTP via the verify_email_otp RPC (purpose='reset').
//      The RPC consumes the code (marks it used) on success.
//   2. Resolve the auth user id from the vendors table (vendors.id == auth uid).
//   3. Set the new password via the admin API.
//
// Deploy with --no-verify-jwt (caller is unauthenticated).
// Uses the auto-injected SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY secrets.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

interface ResetPayload {
  email: string;
  otp: string;
  newPassword: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { email, otp, newPassword } = (await req.json()) as ResetPayload;

    if (!email || !otp || !newPassword) {
      return json({ error: 'email, otp and newPassword are required' }, 400);
    }
    if (newPassword.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Verify + consume the OTP.
    const { data: valid, error: verifyError } = await supabase.rpc('verify_email_otp', {
      p_email: cleanEmail,
      p_code: otp,
      p_purpose: 'reset',
    });
    if (verifyError) throw verifyError;
    if (valid !== true) {
      return json({ error: 'Invalid or expired code' }, 400);
    }

    // 2. Resolve the auth user id (vendors.id == auth.users.id; email is lowercased).
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('id')
      .eq('email', cleanEmail)
      .single();
    if (vendorError || !vendor) {
      return json({ error: 'No account found for that email' }, 404);
    }

    // 3. Set the new password via the admin API.
    const { error: updateError } = await supabase.auth.admin.updateUserById(vendor.id, {
      password: newPassword,
    });
    if (updateError) throw updateError;

    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return json({ error: message }, 500);
  }
});
