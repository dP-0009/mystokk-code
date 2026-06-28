-- ============================================================
-- 040_negotiation_turns.sql
-- Turn-based negotiation + "awaiting me" attention count.
--
-- 1. The requester's INITIAL reservation counts as their first of 3 rounds, so
--    the requester may send at most 2 counters while the responder may send 3
--    (each side still capped at 3 total "rounds" — Spec §4.6).
-- 2. The list RPCs expose latest_round_by_me so the UI can tell whose turn it
--    is (the party who did NOT send the latest counter must respond).
-- 3. count_reservations_awaiting_me() backs the sidebar's pulsing red dot.
-- ============================================================

-- 1. Counter-offer cap: requester's reserve = their round 1 -------------------
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
  v_used     int;
  v_rounds   int;   -- rounds the caller has consumed, counting the reserve
  v_other    uuid;
  v_item     text;
  my_company text;
BEGIN
  SELECT * INTO r FROM reservations
  WHERE reservation_id = p_reservation_id AND (requester_id = me OR responder_id = me)
    AND status IN ('pending', 'negotiating')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found or not actionable'; END IF;

  SELECT count(*) INTO v_used FROM negotiation_rounds
  WHERE reservation_id = p_reservation_id AND proposed_by = me;

  -- The requester's opening reservation counts as their first of 3 rounds.
  v_rounds := v_used + CASE WHEN me = r.requester_id THEN 1 ELSE 0 END;
  IF v_rounds >= 3 THEN
    RAISE EXCEPTION 'You''ve used all 3 negotiation rounds for this reservation.';
  END IF;

  INSERT INTO negotiation_rounds (reservation_id, round_number, proposed_by, counter_price, counter_quantity, message)
  VALUES (p_reservation_id, v_used + 1, me, p_counter_price, p_counter_quantity, NULLIF(p_message, ''));

  UPDATE reservations SET status = 'negotiating', updated_at = now() WHERE reservation_id = p_reservation_id;

  v_other := CASE WHEN me = r.responder_id THEN r.requester_id ELSE r.responder_id END;
  SELECT title INTO v_item FROM inventory WHERE inventory_id = r.inventory_id;
  SELECT company_name INTO my_company FROM vendors WHERE id = me;
  INSERT INTO notifications (vendor_id, type, title, body, related_id)
  VALUES (v_other, 'reservation_countered',
          COALESCE(my_company, 'A vendor') || ' sent a counter-offer',
          v_item || ' · ' || p_counter_quantity::text || ' @ ' || p_counter_price::text, p_reservation_id);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_negotiation_round(uuid, numeric, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_negotiation_round(uuid, numeric, numeric, text) TO authenticated;

-- 2. List RPCs gain latest_round_by_me (true when I sent the latest counter) --
DROP FUNCTION IF EXISTS public.get_reservations_incoming();
DROP FUNCTION IF EXISTS public.get_reservations_outgoing();

CREATE FUNCTION public.get_reservations_incoming()
 RETURNS TABLE(reservation_id uuid, share_id uuid, inventory_id uuid, quantity numeric, offered_price numeric, status text, created_at timestamp with time zone, counterparty_company text, item_title text, currency text, list_price numeric, is_middleman boolean, latest_round integer, latest_counter_price numeric, latest_counter_qty numeric, passthrough_status text, unit text, message text, first_photo_path text, counterparty_email text, latest_round_by_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    r.reservation_id, r.share_id, r.inventory_id, r.quantity, r.offered_price, r.status, r.created_at,
    rq.company_name, i.title,
    COALESCE(sh.forward_currency, i.currency), COALESCE(sh.forward_price, i.price),
    (i.vendor_id <> auth.uid()),
    lr.round_number, lr.counter_price, lr.counter_quantity,
    (SELECT child.status FROM reservations child
      WHERE child.parent_reservation_id = r.reservation_id
      ORDER BY child.created_at DESC LIMIT 1) AS passthrough_status,
    i.unit, r.message,
    (SELECT ph.storage_path FROM inventory_photos ph
      WHERE ph.inventory_id = i.inventory_id
      ORDER BY ph.sort_order ASC, ph.uploaded_at ASC LIMIT 1) AS first_photo_path,
    rq.email AS counterparty_email,
    (lr.proposed_by = auth.uid()) AS latest_round_by_me
  FROM reservations r
  JOIN vendors rq ON rq.id = r.requester_id
  JOIN inventory i ON i.inventory_id = r.inventory_id
  LEFT JOIN shares sh ON sh.share_id = r.share_id
  LEFT JOIN LATERAL (
    SELECT nr.round_number, nr.counter_price, nr.counter_quantity, nr.proposed_by FROM negotiation_rounds nr
    WHERE nr.reservation_id = r.reservation_id ORDER BY nr.seq DESC LIMIT 1
  ) lr ON true
  WHERE r.responder_id = auth.uid()
    AND r.status IN ('pending', 'negotiating', 'passed')
  ORDER BY r.created_at DESC;
$function$;

CREATE FUNCTION public.get_reservations_outgoing()
 RETURNS TABLE(reservation_id uuid, share_id uuid, inventory_id uuid, quantity numeric, offered_price numeric, status text, created_at timestamp with time zone, counterparty_company text, item_title text, currency text, list_price numeric, latest_round integer, latest_counter_price numeric, latest_counter_qty numeric, unit text, message text, first_photo_path text, counterparty_email text, latest_round_by_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    r.reservation_id, r.share_id, r.inventory_id, r.quantity, r.offered_price, r.status, r.created_at,
    rs.company_name AS counterparty_company,
    i.title,
    COALESCE(sh.forward_currency, i.currency) AS currency,
    COALESCE(sh.forward_price, i.price)       AS list_price,
    lr.round_number, lr.counter_price, lr.counter_quantity,
    i.unit, r.message,
    (SELECT ph.storage_path FROM inventory_photos ph
      WHERE ph.inventory_id = i.inventory_id
      ORDER BY ph.sort_order ASC, ph.uploaded_at ASC LIMIT 1) AS first_photo_path,
    rs.email AS counterparty_email,
    (lr.proposed_by = auth.uid()) AS latest_round_by_me
  FROM reservations r
  JOIN vendors rs    ON rs.id = r.responder_id
  JOIN inventory i   ON i.inventory_id = r.inventory_id
  LEFT JOIN shares sh ON sh.share_id = r.share_id
  LEFT JOIN LATERAL (
    SELECT nr.round_number, nr.counter_price, nr.counter_quantity, nr.proposed_by
    FROM negotiation_rounds nr
    WHERE nr.reservation_id = r.reservation_id
    ORDER BY nr.seq DESC
    LIMIT 1
  ) lr ON true
  WHERE r.requester_id = auth.uid()
  ORDER BY r.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_reservations_incoming() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reservations_outgoing() TO authenticated;

-- 3. Count of reservations awaiting THIS vendor's response --------------------
CREATE OR REPLACE FUNCTION public.count_reservations_awaiting_me()
RETURNS integer
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM reservations r
  WHERE r.status IN ('pending', 'negotiating')
    AND (r.requester_id = auth.uid() OR r.responder_id = auth.uid())
    AND (
      -- A fresh request: the seller (responder) must act.
      (r.status = 'pending' AND r.responder_id = auth.uid())
      OR
      -- Mid-negotiation: whoever did NOT send the latest counter must act.
      (r.status = 'negotiating'
       AND COALESCE(
             (SELECT nr.proposed_by FROM negotiation_rounds nr
              WHERE nr.reservation_id = r.reservation_id
              ORDER BY nr.seq DESC LIMIT 1),
             r.requester_id
           ) <> auth.uid())
    );
$$;
REVOKE ALL ON FUNCTION public.count_reservations_awaiting_me() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.count_reservations_awaiting_me() TO authenticated;
