-- Keep settled reservations visible to the SELLER (responder) too. Previously
-- get_reservations_incoming only returned pending/negotiating/passed, so once a
-- request was accepted/rejected (or the buyer cancelled) it vanished from the
-- seller's Reservation Hub. Now it returns every status — the card shows a
-- status tag and hides the action buttons for terminal states — so both parties
-- keep a record. (count_reservations_awaiting_me is unchanged, so the red-dot /
-- badge still only counts actionable items.)
CREATE OR REPLACE FUNCTION public.get_reservations_incoming()
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
  ORDER BY r.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_reservations_incoming() TO authenticated;
