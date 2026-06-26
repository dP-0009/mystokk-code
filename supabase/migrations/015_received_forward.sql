-- ============================================================
-- 015_received_forward.sql
-- Received Items detail + the Forward flow (Build Guide Step 22 / Spec §6.1).
--
-- PRIVACY CHAIN (the whole point of MyStokk):
--   The recipient must only ever see source_vendor_id's public company — never
--   original_owner_id, and never the original inventory.price once a forwarder
--   set a forward_price. All of these RPCs are SECURITY DEFINER, scoped to
--   auth.uid(), and deliberately omit original_owner_id + raw price.
--   Run supabase/tests/privacy_chain_test.sql to prove it (A→B→C).
-- ============================================================

-- ------------------------------------------------------------
-- Single received share for the detail screen, scoped to the caller as the
-- recipient. Returns the privacy-safe display fields + the caller's own
-- reserved quantity. NEVER returns original_owner_id or the raw original price.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_received_share(p_share_id uuid)
RETURNS TABLE (
  share_id           uuid,
  token              text,
  inventory_id       uuid,
  chain_depth        int,
  status             text,
  created_at         timestamptz,
  shared_by_company  text,
  shared_by_logo_url text,
  display_price      numeric,
  display_currency   text,
  forward_remark     text,
  title              text,
  description        text,
  category           text,
  quantity           numeric,
  quantity_available numeric,
  unit               text,
  origin             text,
  specs              jsonb,
  inventory_status   text,
  reserved_by_me     numeric
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT
    s.share_id, s.token, s.inventory_id, s.chain_depth, s.status, s.created_at,
    sv.company_name AS shared_by_company,
    sv.logo_url     AS shared_by_logo_url,
    COALESCE(s.forward_price, i.price)       AS display_price,
    COALESCE(s.forward_currency, i.currency) AS display_currency,
    s.forward_remark,
    i.title, i.description, i.category, i.quantity, i.quantity_available, i.unit, i.origin,
    i.specs, i.status AS inventory_status,
    COALESCE((
      SELECT SUM(r.quantity) FROM reservations r
      WHERE r.share_id = s.share_id AND r.requester_id = auth.uid() AND r.status = 'confirmed'
    ), 0) AS reserved_by_me
  FROM shares s
  JOIN inventory i ON i.inventory_id = s.inventory_id
  JOIN vendors sv  ON sv.id = s.source_vendor_id
  WHERE s.share_id = p_share_id
    AND s.recipient_id = auth.uid()
    AND s.status = 'active'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_received_share(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_received_share(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Forward a received share to N vendors. original_owner_id is COPIED from the
-- parent (never changes down the chain); source_vendor_id becomes the caller
-- (the only identity the downstream recipient will see). Does NOT touch
-- shared_count — that counts the true owner's direct shares only.
-- Returns the number of new forward shares created.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_forward_shares(
  p_parent_share_id uuid,
  p_recipient_ids   uuid[],
  p_forward_price   numeric,
  p_forward_currency text,
  p_forward_remark  text
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me         uuid := auth.uid();
  parent     shares%ROWTYPE;
  rid        uuid;
  new_count  int := 0;
  item_title text;
  my_company text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_recipient_ids IS NULL THEN RETURN 0; END IF;

  SELECT * INTO parent FROM shares WHERE share_id = p_parent_share_id AND status = 'active';
  IF parent.share_id IS NULL THEN RAISE EXCEPTION 'Share not found'; END IF;
  IF parent.recipient_id <> me THEN RAISE EXCEPTION 'You can only forward a share you received'; END IF;

  SELECT title INTO item_title FROM inventory WHERE inventory_id = parent.inventory_id;
  SELECT company_name INTO my_company FROM vendors WHERE id = me;

  FOREACH rid IN ARRAY p_recipient_ids LOOP
    IF rid IS NULL OR rid = me THEN CONTINUE; END IF;
    -- Don't forward the same item to the same vendor twice.
    IF EXISTS (
      SELECT 1 FROM shares s
      WHERE s.inventory_id = parent.inventory_id AND s.recipient_id = rid
        AND s.source_vendor_id = me AND s.status = 'active'
    ) THEN CONTINUE; END IF;

    INSERT INTO shares (
      inventory_id, original_owner_id, source_vendor_id, recipient_id,
      parent_share_id, chain_depth, forward_price, forward_currency, forward_remark, status
    ) VALUES (
      parent.inventory_id, parent.original_owner_id, me, rid,
      parent.share_id, parent.chain_depth + 1, p_forward_price, p_forward_currency, p_forward_remark, 'active'
    );

    INSERT INTO notifications (vendor_id, type, title, body, related_id)
    VALUES (rid, 'share_received', COALESCE(my_company, 'A vendor') || ' shared an item with you', item_title, parent.inventory_id);

    new_count := new_count + 1;
  END LOOP;

  RETURN new_count;  -- intentionally NOT touching inventory.shared_count
END;
$$;
REVOKE ALL ON FUNCTION public.create_forward_shares(uuid, uuid[], numeric, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_forward_shares(uuid, uuid[], numeric, text, text) TO authenticated;

-- ------------------------------------------------------------
-- Forward to a single email. Matched vendor → forward share (+ notification);
-- unmatched → manual reference + a claimable public forward link. Returns
-- { matched, token }.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.forward_by_email(
  p_parent_share_id uuid,
  p_email           text,
  p_forward_price   numeric,
  p_forward_currency text,
  p_forward_remark  text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me         uuid := auth.uid();
  v_email    text := lower(trim(p_email));
  parent     shares%ROWTYPE;
  v_match    uuid;
  v_token    text;
  item_title text;
  my_company text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_email = '' THEN RAISE EXCEPTION 'Email is required'; END IF;

  SELECT * INTO parent FROM shares WHERE share_id = p_parent_share_id AND status = 'active';
  IF parent.share_id IS NULL THEN RAISE EXCEPTION 'Share not found'; END IF;
  IF parent.recipient_id <> me THEN RAISE EXCEPTION 'You can only forward a share you received'; END IF;

  SELECT title INTO item_title FROM inventory WHERE inventory_id = parent.inventory_id;
  SELECT company_name INTO my_company FROM vendors WHERE id = me;
  SELECT id INTO v_match FROM vendors WHERE lower(email) = v_email AND id <> me LIMIT 1;

  IF v_match IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM shares s WHERE s.inventory_id = parent.inventory_id
        AND s.recipient_id = v_match AND s.source_vendor_id = me AND s.status = 'active'
    ) THEN
      SELECT token INTO v_token FROM shares
      WHERE inventory_id = parent.inventory_id AND recipient_id = v_match AND source_vendor_id = me AND status = 'active'
      ORDER BY created_at DESC LIMIT 1;
    ELSE
      INSERT INTO shares (inventory_id, original_owner_id, source_vendor_id, recipient_id, parent_share_id, chain_depth, forward_price, forward_currency, forward_remark, status)
      VALUES (parent.inventory_id, parent.original_owner_id, me, v_match, parent.share_id, parent.chain_depth + 1, p_forward_price, p_forward_currency, p_forward_remark, 'active')
      RETURNING token INTO v_token;
      INSERT INTO notifications (vendor_id, type, title, body, related_id)
      VALUES (v_match, 'share_received', COALESCE(my_company, 'A vendor') || ' shared an item with you', item_title, parent.inventory_id);
    END IF;
    RETURN jsonb_build_object('matched', true, 'token', v_token);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM manual_vendors WHERE owner_vendor_id = me AND lower(email) = v_email) THEN
    INSERT INTO manual_vendors (owner_vendor_id, company_name, email, is_registered)
    VALUES (me, split_part(v_email, '@', 1), v_email, false);
  END IF;

  INSERT INTO shares (inventory_id, original_owner_id, source_vendor_id, recipient_id, parent_share_id, chain_depth, forward_price, forward_currency, forward_remark, status)
  VALUES (parent.inventory_id, parent.original_owner_id, me, NULL, parent.share_id, parent.chain_depth + 1, p_forward_price, p_forward_currency, p_forward_remark, 'active')
  RETURNING token INTO v_token;

  RETURN jsonb_build_object('matched', false, 'token', v_token);
END;
$$;
REVOKE ALL ON FUNCTION public.forward_by_email(uuid, text, numeric, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.forward_by_email(uuid, text, numeric, text, text) TO authenticated;

-- ------------------------------------------------------------
-- Public forward link (recipient_id null) carrying the forwarder's price.
-- original_owner_id copied from the parent. Returns the new token.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_forward_link(
  p_parent_share_id uuid,
  p_forward_price   numeric,
  p_forward_currency text,
  p_forward_remark  text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me      uuid := auth.uid();
  parent  shares%ROWTYPE;
  v_token text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO parent FROM shares WHERE share_id = p_parent_share_id AND status = 'active';
  IF parent.share_id IS NULL THEN RAISE EXCEPTION 'Share not found'; END IF;
  IF parent.recipient_id <> me THEN RAISE EXCEPTION 'You can only forward a share you received'; END IF;

  INSERT INTO shares (inventory_id, original_owner_id, source_vendor_id, recipient_id, parent_share_id, chain_depth, forward_price, forward_currency, forward_remark, status)
  VALUES (parent.inventory_id, parent.original_owner_id, me, NULL, parent.share_id, parent.chain_depth + 1, p_forward_price, p_forward_currency, p_forward_remark, 'active')
  RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.create_forward_link(uuid, numeric, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_forward_link(uuid, numeric, text, text) TO authenticated;
