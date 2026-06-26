-- ============================================================
-- 022_passthrough_progress.sql
-- Pass-to-Supplier visibility + outcome propagation (Build Guide Step 28).
--
--   * The middleman B keeps seeing the ORIGINAL (now status='passed') request
--     from C, with the linked upstream reservation's progress.
--   * When B's supplier (A) accepts/rejects the pass-through reservation, the
--     outcome propagates back to C's original reservation automatically, and C
--     is notified. The stock decrement happens once, at the real owner (A).
-- ============================================================

-- Incoming now also surfaces 'passed' rows + the child reservation's status.
DROP FUNCTION IF EXISTS public.get_reservations_incoming();
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
  latest_counter_qty    numeric,
  passthrough_status    text
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT
    r.reservation_id, r.share_id, r.inventory_id, r.quantity, r.offered_price, r.status, r.created_at,
    rq.company_name, i.title,
    COALESCE(sh.forward_currency, i.currency), COALESCE(sh.forward_price, i.price),
    (i.vendor_id <> auth.uid()),
    lr.round_number, lr.counter_price, lr.counter_quantity,
    (SELECT child.status FROM reservations child
      WHERE child.parent_reservation_id = r.reservation_id
      ORDER BY child.created_at DESC LIMIT 1) AS passthrough_status
  FROM reservations r
  JOIN vendors rq ON rq.id = r.requester_id
  JOIN inventory i ON i.inventory_id = r.inventory_id
  LEFT JOIN shares sh ON sh.share_id = r.share_id
  LEFT JOIN LATERAL (
    SELECT nr.round_number, nr.counter_price, nr.counter_quantity FROM negotiation_rounds nr
    WHERE nr.reservation_id = r.reservation_id ORDER BY nr.seq DESC LIMIT 1
  ) lr ON true
  WHERE r.responder_id = auth.uid()
    AND r.status IN ('pending', 'negotiating', 'passed')
  ORDER BY r.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_reservations_incoming() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_reservations_incoming() TO authenticated;

-- Accept — snaps to latest counter, decrements seller stock, and if this is a
-- pass-through (has parent_reservation_id) confirms the original C reservation.
CREATE OR REPLACE FUNCTION public.accept_reservation(p_reservation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me uuid := auth.uid();
  r reservations%ROWTYPE;
  lr_by uuid; lr_price numeric; lr_qty numeric;
  v_qty numeric; v_price numeric; v_other uuid; v_item text; my_company text;
  v_parent_req uuid;
BEGIN
  SELECT * INTO r FROM reservations WHERE reservation_id = p_reservation_id AND (requester_id = me OR responder_id = me) AND status IN ('pending','negotiating') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found or not actionable'; END IF;
  SELECT proposed_by, counter_price, counter_quantity INTO lr_by, lr_price, lr_qty FROM negotiation_rounds WHERE reservation_id = p_reservation_id ORDER BY seq DESC LIMIT 1;
  IF r.status = 'pending' THEN
    IF me <> r.responder_id THEN RAISE EXCEPTION 'Only the seller can accept this request'; END IF;
  ELSE
    IF lr_by = me THEN RAISE EXCEPTION 'Waiting for the other party to respond to your counter'; END IF;
  END IF;
  v_qty := COALESCE(lr_qty, r.quantity);
  v_price := COALESCE(lr_price, r.offered_price);
  UPDATE reservations SET status = 'confirmed', quantity = v_qty, offered_price = v_price, updated_at = now() WHERE reservation_id = p_reservation_id;
  UPDATE inventory SET quantity_available = GREATEST(quantity_available - v_qty, 0), updated_at = now() WHERE inventory_id = r.inventory_id;
  SELECT title INTO v_item FROM inventory WHERE inventory_id = r.inventory_id;
  SELECT company_name INTO my_company FROM vendors WHERE id = me;
  v_other := CASE WHEN me = r.responder_id THEN r.requester_id ELSE r.responder_id END;
  INSERT INTO notifications (vendor_id, type, title, body, related_id)
  VALUES (v_other, 'reservation_accepted', COALESCE(my_company, 'The other party') || ' accepted the reservation', v_item || ' · Qty ' || v_qty::text, r.reservation_id);

  -- Propagate up to the original downstream (C) reservation.
  IF r.parent_reservation_id IS NOT NULL THEN
    UPDATE reservations SET status = 'confirmed', updated_at = now() WHERE reservation_id = r.parent_reservation_id;
    SELECT requester_id INTO v_parent_req FROM reservations WHERE reservation_id = r.parent_reservation_id;
    INSERT INTO notifications (vendor_id, type, title, body, related_id)
    VALUES (v_parent_req, 'reservation_accepted', 'Your reservation is confirmed', v_item || ' · Qty ' || v_qty::text, r.parent_reservation_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_reservation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_reservation(uuid) TO authenticated;

-- Reject — and if this is a pass-through, reject the original C reservation too.
CREATE OR REPLACE FUNCTION public.reject_reservation(p_reservation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  r reservations%ROWTYPE;
  v_item text; my_company text; v_parent_req uuid;
BEGIN
  SELECT * INTO r FROM reservations WHERE reservation_id = p_reservation_id AND responder_id = auth.uid() AND status IN ('pending','negotiating') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found or not actionable'; END IF;
  UPDATE reservations SET status = 'rejected', updated_at = now() WHERE reservation_id = p_reservation_id;
  SELECT title INTO v_item FROM inventory WHERE inventory_id = r.inventory_id;
  SELECT company_name INTO my_company FROM vendors WHERE id = auth.uid();
  INSERT INTO notifications (vendor_id, type, title, body, related_id)
  VALUES (r.requester_id, 'reservation_rejected', COALESCE(my_company, 'The seller') || ' declined your reservation', v_item || ' · Qty ' || r.quantity::text, r.reservation_id);

  IF r.parent_reservation_id IS NOT NULL THEN
    UPDATE reservations SET status = 'rejected', updated_at = now() WHERE reservation_id = r.parent_reservation_id;
    SELECT requester_id INTO v_parent_req FROM reservations WHERE reservation_id = r.parent_reservation_id;
    INSERT INTO notifications (vendor_id, type, title, body, related_id)
    VALUES (v_parent_req, 'reservation_rejected', 'Your reservation could not be fulfilled', v_item || ' · Qty ' || r.quantity::text, r.parent_reservation_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_reservation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reject_reservation(uuid) TO authenticated;
