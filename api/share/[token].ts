/**
 * GET /api/share/:token — link-unfurl shim for public share links.
 *
 * Thin wrapper: reads the token and delegates to the shared unfurl core
 * (bot → Open Graph HTML, human → 302 to the SPA share landing). See
 * ../_share-core.ts. The /api/s/:code endpoint reuses the same core.
 */

import { redirectHome, respondForToken, type ShareReq, type ShareRes } from '../_share-core';

export default async function handler(req: ShareReq, res: ShareRes): Promise<void> {
  const rawToken = req.query.token;
  const token = String(Array.isArray(rawToken) ? rawToken[0] : rawToken ?? '');
  if (!token) {
    redirectHome(res);
    return;
  }
  await respondForToken(req, res, token);
}
