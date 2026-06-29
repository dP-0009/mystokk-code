-- "Shared With" on the Received Inventory detail: list the forwards the CURRENT
-- user made from a received share — the downstream parallel of the owner's
-- get_item_direct_shares.
--
-- PRIVACY (the whole point): rows are scoped to source_vendor_id = auth.uid()
-- and parent_share_id = the caller's received share. So a recipient only ever
-- sees the people THEY forwarded to — never who the upstream owner or any other
-- forwarder shared with. If A → B → C, B sees only B's own forwards (not A's
-- siblings), and C sees only C's own forwards (not A's or B's).
CREATE OR REPLACE FUNCTION public.get_forward_shares(p_parent_share_id uuid)
RETURNS TABLE (
  share_id          uuid,
  recipient_id      uuid,
  recipient_company text,
  recipient_email   text,
  token             text,
  status            text,
  created_at        timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT s.share_id, s.recipient_id, v.company_name, v.email, s.token, s.status, s.created_at
  FROM shares s
  LEFT JOIN vendors v ON v.id = s.recipient_id
  WHERE s.parent_share_id = p_parent_share_id
    AND s.source_vendor_id = auth.uid()
  ORDER BY s.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_forward_shares(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_forward_shares(uuid) TO authenticated;
