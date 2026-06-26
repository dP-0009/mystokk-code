-- ============================================================
-- 012_inventory_detail_rpcs.sql
-- Owner-facing detail helpers. The owner needs to see the COMPANY NAMES of
-- vendors they shared with / who reserved — but vendors RLS is self-only, so
-- expose just those public fields via SECURITY DEFINER RPCs scoped to the
-- owner (auth.uid()).
-- ============================================================

-- Direct-share activity for an item the caller owns (chain_depth 0, named recipients).
CREATE OR REPLACE FUNCTION public.get_item_share_activity(p_inventory_id uuid)
RETURNS TABLE (recipient_company text, shared_at timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT v.company_name, s.created_at
  FROM shares s
  JOIN vendors v ON v.id = s.recipient_id
  WHERE s.inventory_id = p_inventory_id
    AND s.source_vendor_id = auth.uid()
    AND s.original_owner_id = auth.uid()
    AND s.chain_depth = 0
    AND s.recipient_id IS NOT NULL
  ORDER BY s.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_item_share_activity(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_item_share_activity(uuid) TO authenticated;

-- Pending/negotiating reservations on an item the caller owns (responder side).
CREATE OR REPLACE FUNCTION public.get_item_reservations(p_inventory_id uuid)
RETURNS TABLE (
  reservation_id uuid,
  requester_company text,
  quantity numeric,
  offered_price numeric,
  status text,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT r.reservation_id, v.company_name, r.quantity, r.offered_price, r.status, r.created_at
  FROM reservations r
  JOIN vendors v ON v.id = r.requester_id
  WHERE r.inventory_id = p_inventory_id
    AND r.responder_id = auth.uid()
    AND r.status IN ('pending', 'negotiating')
  ORDER BY r.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_item_reservations(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_item_reservations(uuid) TO authenticated;
