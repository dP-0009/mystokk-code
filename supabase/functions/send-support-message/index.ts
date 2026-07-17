// ============================================================================
// send-support-message — Supabase Edge Function (Deno)
//
// Contact / support form submissions from the app AND the web Contact page.
// Reuses the SAME email provider as send-email (Resend + the same secrets):
//   RESEND_API_KEY, RESEND_FROM_EMAIL
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Flow: validate → INSERT into support_messages (so nothing is ever lost, even
// if the email fails) → email the full submission to support@mystokk.app with
// reply-to set to the submitter so support can reply directly.
//
// verify_jwt is DISABLED: the Contact page is reachable while signed out, so
// this must accept anonymous submissions. When a real user token is present we
// resolve their id for the row (best-effort), otherwise user_id is null.
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

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@mystokk.app';
const SUPPORT_TO = 'support@mystokk.app';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = ['Account', 'Bug', 'Feedback', 'Other'];
const MIN_MESSAGE = 10;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    const topic = String(body.topic ?? '').trim();
    const message = String(body.message ?? '').trim();

    // ---- validation --------------------------------------------------------
    if (!name || !email || !topic || !message) {
      return json({ error: 'Name, email, topic, and message are all required.' }, 400);
    }
    if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
    if (!TOPICS.includes(topic)) return json({ error: 'Please choose a valid topic.' }, 400);
    if (message.length < MIN_MESSAGE) {
      return json({ error: `Message must be at least ${MIN_MESSAGE} characters.` }, 400);
    }

    // ---- resolve the signed-in user (best-effort; the form is public) ------
    let userId: string | null = null;
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    // ---- persist first so a submission is never lost -----------------------
    const { error: insertError } = await supabase
      .from('support_messages')
      .insert({ user_id: userId, name, email, topic, message });
    if (insertError) throw insertError;

    // ---- email the full submission to support ------------------------------
    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
      <h2 style="margin:0 0 12px;">New support message</h2>
      <p style="margin:0 0 4px;"><strong>Topic:</strong> ${escapeHtml(topic)}</p>
      <p style="margin:0 0 4px;"><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
      <p style="margin:0 0 12px;color:#64748B;font-size:13px;"><strong>User ID:</strong> ${userId ?? '—'}</p>
      <div style="padding:14px 16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;white-space:pre-wrap;line-height:1.55;">${escapeHtml(message)}</div>
    </body></html>`;
    const text = `New support message\n\nTopic: ${topic}\nFrom: ${name} <${email}>\nUser ID: ${userId ?? '—'}\n\n${message}`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: SUPPORT_TO,
        reply_to: email,
        subject: `[MyStokk Support] ${topic} — ${name}`,
        html,
        text,
      }),
    });

    if (!resp.ok) {
      // The row is already saved, so surface the email failure without losing data.
      const detail = await resp.text();
      return json({ error: `Message saved but email delivery failed (${resp.status}): ${detail}` }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return json({ error: message }, 500);
  }
});
