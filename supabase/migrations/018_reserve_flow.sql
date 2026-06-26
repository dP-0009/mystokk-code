-- ============================================================
-- 018_reserve_flow.sql
-- Reserve flow (Build Guide Step 25 / Spec §6.2).
--
--   create_reservation validates the requested quantity against what's actually
--   available to THIS vendor through THEIR share — inventory.quantity_available
--   minus quantity already reserved by others through DIFFERENT shares
--   (pending/negotiating; confirmed reservations have already reduced
--   quantity_available via accept_reservation). It then writes the reservation,
--   notifies the responder (the share's source_vendor_id), and returns the id.
--
-- SECURITY DEFINER: the responder notification is a row for ANOTHER vendor,
-- which notifications_own RLS forbids from the client.
-- ============================================================

-- Re-expose get_received_share with an available_to_me column so the Reserve
-- sheet can show + cap the quantity. (Same body as 015 + the new field.)
-- Drop first: adding an OUT column changes the return type.
DROP FUNCTION IF EXISTS public.get_received_share(uuid);
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
  reserved_by_me     numeric,
  available_to_me    numeric
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
    ), 0) AS reserved_by_me,
    GREATEST(
      i.quantity_available - COALESCE((
        SELECT SUM(r.quantity) FROM reservations r
        WHERE r.inventory_id = s.inventory_id AND r.share_id <> s.share_id
          AND r.status IN ('pending', 'negotiating')
      ), 0),
      0
    ) AS available_to_me
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

-- Create a reservation against a received share.
CREATE OR REPLACE FUNCTION public.create_reservation(
  p_inventory_id  uuid,
  p_share_id      uuid,
  p_quantity      numeric,
  p_offered_price numeric,
  p_message       text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me         uuid := auth.uid();
  s          shares%ROWTYPE;
  v_avail    numeric;
  v_item     text;
  my_company text;
  v_res_id   uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than 0'; END IF;

  SELECT * INTO s FROM shares WHERE share_id = p_share_id AND status = 'active';
  IF s.share_id IS NULL THEN RAISE EXCEPTION 'Share not found'; END IF;
  IF s.recipient_id <> me THEN RAISE EXCEPTION 'You can only reserve a share you received'; END IF;
  IF s.inventory_id <> p_inventory_id THEN RAISE EXCEPTION 'Share/item mismatch'; END IF;

  -- Available to THIS vendor = global available minus others' pending/negotiating
  -- reservations made through DIFFERENT shares.
  SELECT GREATEST(
    i.quantity_available - COALESCE((
      SELECT SUM(r.quantity) FROM reservations r
      WHERE r.inventory_id = s.inventory_id AND r.share_id <> s.share_id
        AND r.status IN ('pending', 'negotiating')
    ), 0), 0)
  INTO v_avail
  FROM inventory i WHERE i.inventory_id = s.inventory_id;

  IF p_quantity > v_avail THEN
    RAISE EXCEPTION 'Only % available to reserve right now', v_avail;
  END IF;

  SELECT title INTO v_item FROM inventory WHERE inventory_id = s.inventory_id;
  SELECT company_name INTO my_company FROM vendors WHERE id = me;

  INSERT INTO reservations (inventory_id, share_id, requester_id, responder_id, quantity, offered_price, message, status)
  VALUES (s.inventory_id, s.share_id, me, s.source_vendor_id, p_quantity, p_offered_price, NULLIF(p_message, ''), 'pending')
  RETURNING reservation_id INTO v_res_id;

  INSERT INTO notifications (vendor_id, type, title, body, related_id)
  VALUES (
    s.source_vendor_id, 'reservation_request',
    COALESCE(my_company, 'A vendor') || ' wants to reserve ' || COALESCE(v_item, 'an item'),
    'Qty ' || p_quantity::text || COALESCE(' · offer ' || p_offered_price::text, ''),
    v_res_id
  );

  RETURN v_res_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_reservation(uuid, uuid, numeric, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_reservation(uuid, uuid, numeric, numeric, text) TO authenticated;
