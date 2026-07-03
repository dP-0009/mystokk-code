/**
 * GET /api/s/:code — compact share link. Resolves the short code to its share
 * token (anon-safe RPC), then delegates to the shared unfurl core so it behaves
 * exactly like /api/share/:token (bot → OG HTML, human → 302 to the SPA landing).
 *
 * Reached via the `/s/:code → /api/s/:code` rewrite in vercel.json, so end users
 * see the short mystokk.vercel.app/s/<code> form.
 */

import { redirectHome, respondForToken, tokenForShortCode, type ShareReq, type ShareRes } from '../_share-core';

export default async function handler(req: ShareReq, res: ShareRes): Promise<void> {
  const rawCode = req.query.code;
  const code = String(Array.isArray(rawCode) ? rawCode[0] : rawCode ?? '').trim();
  if (!code) {
    redirectHome(res);
    return;
  }
  const token = await tokenForShortCode(code);
  if (!token) {
    redirectHome(res);
    return;
  }
  await respondForToken(req, res, token);
}
