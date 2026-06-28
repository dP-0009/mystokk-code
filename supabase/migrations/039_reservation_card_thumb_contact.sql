-- Add a thumbnail photo path + counterparty email to the reservation list RPCs
-- so the Reservation Hub cards can show a product thumbnail and an email
-- contact action. Return signatures change → drop + recreate.
DROP FUNCTION IF EXISTS public.get_reservations_incoming();
DROP FUNCTION IF EXISTS public.get_reservations_outgoing();

CREATE FUNCTION public.get_reservations_incoming()
 RETURNS TABLE(reservation_id uuid, share_id uuid, inventory_id uuid, quantity numeric, offered_price numeric, status text, created_at timestamp with time zone, counterparty_company text, item_title text, currency text, list_price numeric, is_middleman boolean, latest_round integer, latest_counter_price numeric, latest_counter_qty numeric, passthrough_status text, unit text, message text, first_photo_path text, counterparty_email text)
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
    rq.email AS counterparty_email
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
$function$;

CREATE FUNCTION public.get_reservations_outgoing()
 RETURNS TABLE(reservation_id uuid, share_id uuid, inventory_id uuid, quantity numeric, offered_price numeric, status text, created_at timestamp with time zone, counterparty_company text, item_title text, currency text, list_price numeric, latest_round integer, latest_counter_price numeric, latest_counter_qty numeric, unit text, message text, first_photo_path text, counterparty_email text)
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
    rs.email AS counterparty_email
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
$function$;

GRANT EXECUTE ON FUNCTION public.get_reservations_incoming() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reservations_outgoing() TO authenticated;
