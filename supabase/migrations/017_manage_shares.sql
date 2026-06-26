-- ============================================================
-- 017_manage_shares.sql
-- Manage Shares (Build Guide Step 24).
--   * List every DIRECT share (chain_depth = 0) the owner created for an item.
--   * Revoke a share → status='revoked', cascading to ALL downstream forwards
--     (the chain depends on each parent share staying active).
-- Owner-scoped SECURITY DEFINER (vendors RLS is self-only, and the cascade must
-- reach forwards the owner isn't party to).
-- ============================================================

-- Direct shares for an item the caller owns. recipient_company is NULL for a
-- public-forward link (recipient_id null). Returns active + revoked so the UI
-- can show status; the Revoke button is only offered on active rows.
CREATE OR REPLACE FUNCTION public.get_item_direct_shares(p_inventory_id uuid)
RETURNS TABLE (
  share_id          uuid,
  recipient_id      uuid,
  recipient_company text,
  token             text,
  status            text,
  created_at        timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT s.share_id, s.recipient_id, v.company_name, s.token, s.status, s.created_at
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

-- Revoke a share and every forward beneath it. Only the original owner (or the
-- vendor who sourced that hop) may revoke. Returns the number of shares revoked.
CREATE OR REPLACE FUNCTION public.revoke_share(p_share_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me       uuid := auth.uid();
  owns     boolean;
  affected int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM shares
    WHERE share_id = p_share_id AND (original_owner_id = me OR source_vendor_id = me)
  ) INTO owns;
  IF NOT owns THEN RAISE EXCEPTION 'Not authorized to revoke this share'; END IF;

  WITH RECURSIVE subtree AS (
    SELECT share_id FROM shares WHERE share_id = p_share_id
    UNION ALL
    SELECT s.share_id FROM shares s JOIN subtree t ON s.parent_share_id = t.share_id
  )
  UPDATE shares SET status = 'revoked', updated_at = now()
  WHERE share_id IN (SELECT share_id FROM subtree) AND status <> 'revoked';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_share(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.revoke_share(uuid) TO authenticated;
