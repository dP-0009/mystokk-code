-- ============================================================
-- 016_self_share_protection.sql
-- Owner self-share protection (Build Guide Step 23 / Spec §7.6).
--
--   When a vendor opens a public share link to their OWN item (their id =
--   original_owner_id OR source_vendor_id), they must be routed to their own
--   Inventory Detail — never Received Detail.
--
--   Defensive cleanup: a share whose recipient_id = original_owner_id is a bogus
--   self-share that should never exist. Delete it on encounter and log it.
-- ============================================================

-- Non-mutating resolver (except the defensive cleanup). Does NOT claim a public
-- link — claiming for a genuine recipient stays in claim_share, invoked from the
-- ShareLanding action button. Returns:
--   { found, is_owner, inventory_id, share_id?, cleaned }
CREATE OR REPLACE FUNCTION public.resolve_share_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me      uuid := auth.uid();
  s       shares%ROWTYPE;
  cleaned boolean := false;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO s FROM shares WHERE token = p_token LIMIT 1;
  IF s.share_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Defensive cleanup of a bogus self-share (recipient_id = original_owner_id).
  IF s.recipient_id IS NOT NULL AND s.recipient_id = s.original_owner_id THEN
    DELETE FROM shares WHERE share_id = s.share_id;
    RAISE WARNING 'self-share cleanup: deleted bogus share % (recipient_id = original_owner_id = %)',
      s.share_id, s.original_owner_id;
    cleaned := true;
  END IF;

  -- Owner self-share protection.
  IF me = s.original_owner_id OR me = s.source_vendor_id THEN
    RETURN jsonb_build_object('found', true, 'is_owner', true, 'inventory_id', s.inventory_id, 'cleaned', cleaned);
  END IF;

  RETURN jsonb_build_object(
    'found', true, 'is_owner', false,
    'share_id', s.share_id, 'inventory_id', s.inventory_id, 'cleaned', cleaned
  );
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_share_token(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.resolve_share_token(text) TO authenticated;

-- Belt-and-suspenders: claim_share also performs the defensive cleanup and the
-- owner check before claiming, so the action-button path is protected too.
CREATE OR REPLACE FUNCTION public.claim_share(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me uuid := auth.uid();
  s  shares%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO s FROM shares WHERE token = p_token AND status = 'active' LIMIT 1;
  IF s.share_id IS NULL THEN RAISE EXCEPTION 'Share not found'; END IF;

  -- Defensive cleanup of a bogus self-share before anything else.
  IF s.recipient_id IS NOT NULL AND s.recipient_id = s.original_owner_id THEN
    DELETE FROM shares WHERE share_id = s.share_id;
    RAISE WARNING 'self-share cleanup: deleted bogus share % (recipient_id = original_owner_id = %)',
      s.share_id, s.original_owner_id;
    RETURN jsonb_build_object('is_owner', true, 'share_id', s.share_id, 'inventory_id', s.inventory_id);
  END IF;

  IF me = s.original_owner_id OR me = s.source_vendor_id THEN
    RETURN jsonb_build_object('is_owner', true, 'share_id', s.share_id, 'inventory_id', s.inventory_id);
  END IF;

  IF s.recipient_id IS NULL THEN
    UPDATE shares SET recipient_id = me, updated_at = NOW() WHERE share_id = s.share_id;
  END IF;

  RETURN jsonb_build_object('is_owner', false, 'share_id', s.share_id, 'inventory_id', s.inventory_id);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_share(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_share(text) TO authenticated;
