-- ============================================================
-- 019_reservations_hub.sql
-- Reservations screen — Incoming / My Reservations (Build Guide Step 26 / §6.3).
--
-- Counterparty company names + cross-vendor notifications need SECURITY DEFINER
-- (vendors RLS is self-only; notifications_own forbids writing another vendor's
-- row from the client). inventory.status (sold_out / partially_reserved) is set
-- automatically by the update_inventory_status trigger when quantity_available
-- changes, so accept only has to decrement.
-- ============================================================

-- ---- Incoming: reservations where the caller is the responder ----------------
CREATE OR REPLACE FUNCTION public.get_reservations_incoming()
RETURNS TABLE (
  reservation_id        uuid,
  share_id              uuid,
  inventory_id          uuid,
  quantity              numeric,
  offered_price         numeric,
  status                text,
  created_at            timestamptz,
  counterparty_company  text,
  item_title            text,
  currency              text,
  list_price            numeric,
  is_middleman          boolean,
  latest_round          int,
  latest_counter_price  numeric,
  latest_counter_qty    numeric
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT
    r.reservation_id, r.share_id, r.inventory_id, r.quantity, r.offered_price, r.status, r.created_at,
    rq.company_name AS counterparty_company,
    i.title,
    COALESCE(sh.forward_currency, i.currency) AS currency,
    COALESCE(sh.forward_price, i.price)       AS list_price,
    (i.vendor_id <> auth.uid())               AS is_middleman,
    lr.round_number, lr.counter_price, lr.counter_quantity
  FROM reservations r
  JOIN vendors rq    ON rq.id = r.requester_id
  JOIN inventory i   ON i.inventory_id = r.inventory_id
  LEFT JOIN shares sh ON sh.share_id = r.share_id
  LEFT JOIN LATERAL (
    SELECT nr.round_number, nr.counter_price, nr.counter_quantity
    FROM negotiation_rounds nr
    WHERE nr.reservation_id = r.reservation_id
    ORDER BY nr.round_number DESC, nr.created_at DESC
    LIMIT 1
  ) lr ON true
  WHERE r.responder_id = auth.uid()
    AND r.status IN ('pending', 'negotiating')
  ORDER BY r.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_reservations_incoming() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_reservations_incoming() TO authenticated;

-- ---- My Reservations: reservations where the caller is the requester ---------
CREATE OR REPLACE FUNCTION public.get_reservations_outgoing()
RETURNS TABLE (
  reservation_id       uuid,
  share_id             uuid,
  inventory_id         uuid,
  quantity             numeric,
  offered_price        numeric,
  status               text,
  created_at           timestamptz,
  counterparty_company text,
  item_title           text,
  currency             text,
  list_price           numeric,
  latest_round         int,
  latest_counter_price numeric,
  latest_counter_qty   numeric
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT
    r.reservation_id, r.share_id, r.inventory_id, r.quantity, r.offered_price, r.status, r.created_at,
    rs.company_name AS counterparty_company,
    i.title,
    COALESCE(sh.forward_currency, i.currency) AS currency,
    COALESCE(sh.forward_price, i.price)       AS list_price,
    lr.round_number, lr.counter_price, lr.counter_quantity
  FROM reservations r
  JOIN vendors rs    ON rs.id = r.responder_id
  JOIN inventory i   ON i.inventory_id = r.inventory_id
  LEFT JOIN shares sh ON sh.share_id = r.share_id
  LEFT JOIN LATERAL (
    SELECT nr.round_number, nr.counter_price, nr.counter_quantity
    FROM negotiation_rounds nr
    WHERE nr.reservation_id = r.reservation_id
    ORDER BY nr.round_number DESC, nr.created_at DESC
    LIMIT 1
  ) lr ON true
  WHERE r.requester_id = auth.uid()
  ORDER BY r.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_reservations_outgoing() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_reservations_outgoing() TO authenticated;

-- ---- Accept: confirm + decrement + notify requester --------------------------
CREATE OR REPLACE FUNCTION public.accept_reservation(p_reservation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  r          reservations%ROWTYPE;
  v_item     text;
  my_company text;
BEGIN
  SELECT * INTO r FROM reservations
  WHERE reservation_id = p_reservation_id AND responder_id = auth.uid()
    AND status IN ('pending', 'negotiating')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found or not actionable'; END IF;

  UPDATE reservations SET status = 'confirmed', updated_at = now() WHERE reservation_id = p_reservation_id;

  -- Decrement available stock; the update_inventory_status trigger flips the
  -- item to partially_reserved / sold_out automatically.
  UPDATE inventory
  SET quantity_available = GREATEST(quantity_available - r.quantity, 0), updated_at = now()
  WHERE inventory_id = r.inventory_id;

  SELECT title INTO v_item FROM inventory WHERE inventory_id = r.inventory_id;
  SELECT company_name INTO my_company FROM vendors WHERE id = auth.uid();
  INSERT INTO notifications (vendor_id, type, title, body, related_id)
  VALUES (r.requester_id, 'reservation_accepted',
          COALESCE(my_company, 'The seller') || ' accepted your reservation',
          v_item || ' · Qty ' || r.quantity::text, r.reservation_id);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_reservation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_reservation(uuid) TO authenticated;

-- ---- Reject: no quantity change + notify requester ---------------------------
CREATE OR REPLACE FUNCTION public.reject_reservation(p_reservation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  r          reservations%ROWTYPE;
  v_item     text;
  my_company text;
BEGIN
  SELECT * INTO r FROM reservations
  WHERE reservation_id = p_reservation_id AND responder_id = auth.uid()
    AND status IN ('pending', 'negotiating')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found or not actionable'; END IF;

  UPDATE reservations SET status = 'rejected', updated_at = now() WHERE reservation_id = p_reservation_id;

  SELECT title INTO v_item FROM inventory WHERE inventory_id = r.inventory_id;
  SELECT company_name INTO my_company FROM vendors WHERE id = auth.uid();
  INSERT INTO notifications (vendor_id, type, title, body, related_id)
  VALUES (r.requester_id, 'reservation_rejected',
          COALESCE(my_company, 'The seller') || ' declined your reservation',
          v_item || ' · Qty ' || r.quantity::text, r.reservation_id);
END;
$$;
REVOKE ALL ON FUNCTION public.reject_reservation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reject_reservation(uuid) TO authenticated;

-- ---- Negotiate: add a counter round + notify the other party -----------------
-- The negotiation_rounds_cap trigger blocks a 4th round per vendor.
CREATE OR REPLACE FUNCTION public.submit_negotiation_round(
  p_reservation_id  uuid,
  p_counter_price   numeric,
  p_counter_quantity numeric,
  p_message         text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me         uuid := auth.uid();
  r          reservations%ROWTYPE;
  v_next     int;
  v_other    uuid;
  v_item     text;
  my_company text;
BEGIN
  SELECT * INTO r FROM reservations
  WHERE reservation_id = p_reservation_id AND (requester_id = me OR responder_id = me)
    AND status IN ('pending', 'negotiating')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found or not actionable'; END IF;

  SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_next
  FROM negotiation_rounds WHERE reservation_id = p_reservation_id AND proposed_by = me;

  INSERT INTO negotiation_rounds (reservation_id, round_number, proposed_by, counter_price, counter_quantity, message)
  VALUES (p_reservation_id, v_next, me, p_counter_price, p_counter_quantity, NULLIF(p_message, ''));

  UPDATE reservations SET status = 'negotiating', updated_at = now() WHERE reservation_id = p_reservation_id;

  v_other := CASE WHEN me = r.responder_id THEN r.requester_id ELSE r.responder_id END;
  SELECT title INTO v_item FROM inventory WHERE inventory_id = r.inventory_id;
  SELECT company_name INTO my_company FROM vendors WHERE id = me;
  INSERT INTO notifications (vendor_id, type, title, body, related_id)
  VALUES (v_other, 'reservation_countered',
          COALESCE(my_company, 'A vendor') || ' sent a counter-offer',
          v_item || ' · Round ' || v_next::text, p_reservation_id);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_negotiation_round(uuid, numeric, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_negotiation_round(uuid, numeric, numeric, text) TO authenticated;

-- ---- Pass to Supplier: a middleman forwards the request one hop upstream ------
CREATE OR REPLACE FUNCTION public.pass_to_supplier(p_reservation_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me           uuid := auth.uid();
  r            reservations%ROWTYPE;
  v_parent     uuid;
  v_supplier   uuid;
  v_new        uuid;
  v_item       text;
  my_company   text;
BEGIN
  SELECT * INTO r FROM reservations
  WHERE reservation_id = p_reservation_id AND responder_id = me
    AND status IN ('pending', 'negotiating')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found or not actionable'; END IF;

  -- The share I received this item through, and its parent (my upstream supplier).
  SELECT sh.parent_share_id INTO v_parent FROM shares sh WHERE sh.share_id = r.share_id;
  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'No upstream supplier — this item is yours to fulfil';
  END IF;
  SELECT source_vendor_id INTO v_supplier FROM shares WHERE share_id = v_parent;

  INSERT INTO reservations (inventory_id, share_id, requester_id, responder_id, quantity, offered_price, message, parent_reservation_id, status)
  VALUES (r.inventory_id, v_parent, me, v_supplier, r.quantity, r.offered_price, 'Passed through from a downstream buyer', r.reservation_id, 'pending')
  RETURNING reservation_id INTO v_new;

  UPDATE reservations SET status = 'passed', updated_at = now() WHERE reservation_id = p_reservation_id;

  SELECT title INTO v_item FROM inventory WHERE inventory_id = r.inventory_id;
  SELECT company_name INTO my_company FROM vendors WHERE id = me;
  INSERT INTO notifications (vendor_id, type, title, body, related_id)
  VALUES (v_supplier, 'reservation_request',
          COALESCE(my_company, 'A vendor') || ' wants to reserve ' || COALESCE(v_item, 'an item'),
          'Qty ' || r.quantity::text, v_new);

  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.pass_to_supplier(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.pass_to_supplier(uuid) TO authenticated;
