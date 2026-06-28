-- Add the recipient's email to the owner's direct-shares list so the Manage
-- Shares modal can show it. Still owner-scoped (caller must be the original
-- owner AND the source), so a recipient never sees who else an item was shared
-- with — only the owner's own direct shares are returned.
DROP FUNCTION IF EXISTS public.get_item_direct_shares(uuid);

CREATE FUNCTION public.get_item_direct_shares(p_inventory_id uuid)
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
  WHERE s.inventory_id = p_inventory_id
    AND s.original_owner_id = auth.uid()
    AND s.source_vendor_id  = auth.uid()
    AND s.chain_depth = 0
  ORDER BY s.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_item_direct_shares(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_item_direct_shares(uuid) TO authenticated;
