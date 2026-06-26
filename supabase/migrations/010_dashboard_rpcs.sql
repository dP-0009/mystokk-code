-- ============================================================
-- 010_dashboard_rpcs.sql
-- Dashboard helpers. vendors RLS is self-only, so the responder can't
-- directly read a requester's company name — expose just the needed
-- counterparty fields via a SECURITY DEFINER RPC scoped to auth.uid().
-- ============================================================

-- Incoming (pending) reservations for the current responder, with the
-- requester's public info + the item info. Scoped to auth.uid() = responder.
CREATE OR REPLACE FUNCTION public.get_incoming_reservations(p_limit integer DEFAULT 3)
RETURNS TABLE (
  reservation_id    uuid,
  quantity          numeric,
  offered_price     numeric,
  status            text,
  created_at        timestamptz,
  requester_company text,
  requester_contact text,
  item_title        text,
  item_currency     text,
  item_price        numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT r.reservation_id, r.quantity, r.offered_price, r.status, r.created_at,
         rq.company_name, rq.contact_person,
         i.title, i.currency, i.price
  FROM reservations r
  JOIN vendors rq ON rq.id = r.requester_id
  JOIN inventory i ON i.inventory_id = r.inventory_id
  WHERE r.responder_id = auth.uid()
    AND r.status = 'pending'
  ORDER BY r.created_at DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_incoming_reservations(integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_incoming_reservations(integer) TO authenticated;

-- Atomically accept a reservation the caller is the responder for:
-- mark confirmed + decrement available stock (status auto-updates via trigger).
CREATE OR REPLACE FUNCTION public.accept_reservation(p_reservation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r reservations%ROWTYPE;
BEGIN
  SELECT * INTO r FROM reservations
  WHERE reservation_id = p_reservation_id
    AND responder_id = auth.uid()
    AND status IN ('pending', 'negotiating')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found or not actionable';
  END IF;

  UPDATE reservations SET status = 'confirmed', updated_at = now()
  WHERE reservation_id = p_reservation_id;

  UPDATE inventory
  SET quantity_available = GREATEST(quantity_available - r.quantity, 0),
      updated_at = now()
  WHERE inventory_id = r.inventory_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_reservation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_reservation(uuid) TO authenticated;
