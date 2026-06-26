-- ============================================================
-- 021_negotiation_seq.sql
-- Give negotiation_rounds a monotonic sequence so "the latest counter" is
-- unambiguous even if two rounds share a created_at timestamp. (created_at is
-- frozen within a transaction, so ties are otherwise possible.) Accept snaps to
-- the row with the highest seq; the history timeline orders by seq.
-- ============================================================

ALTER TABLE negotiation_rounds ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY;

CREATE OR REPLACE FUNCTION public.get_negotiation_rounds(p_reservation_id uuid)
RETURNS TABLE (
  round_number int, proposed_by uuid, proposer_company text, is_me boolean,
  counter_price numeric, counter_quantity numeric, message text, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT nr.round_number, nr.proposed_by, v.company_name,
         (nr.proposed_by = auth.uid()) AS is_me,
         nr.counter_price, nr.counter_quantity, nr.message, nr.created_at
  FROM negotiation_rounds nr
  JOIN reservations r ON r.reservation_id = nr.reservation_id
  JOIN vendors v ON v.id = nr.proposed_by
  WHERE nr.reservation_id = p_reservation_id
    AND (r.requester_id = auth.uid() OR r.responder_id = auth.uid())
  ORDER BY nr.seq ASC;
$$;
REVOKE ALL ON FUNCTION public.get_negotiation_rounds(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_negotiation_rounds(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_reservation(p_reservation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me uuid := auth.uid();
  r reservations%ROWTYPE;
  lr_by uuid;
  lr_price numeric;
  lr_qty numeric;
  v_qty numeric;
  v_price numeric;
  v_other uuid;
  v_item text;
  my_company text;
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
  v_other := CASE WHEN me = r.responder_id THEN r.requester_id ELSE r.responder_id END;
  SELECT title INTO v_item FROM inventory WHERE inventory_id = r.inventory_id;
  SELECT company_name INTO my_company FROM vendors WHERE id = me;
  INSERT INTO notifications (vendor_id, type, title, body, related_id)
  VALUES (v_other, 'reservation_accepted', COALESCE(my_company, 'The other party') || ' accepted the reservation', v_item || ' · Qty ' || v_qty::text, r.reservation_id);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_reservation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_reservation(uuid) TO authenticated;
