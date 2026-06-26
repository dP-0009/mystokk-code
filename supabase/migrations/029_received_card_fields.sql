-- ============================================================
-- 029_received_card_fields.sql
-- Surfaces two more inventory display fields on the Received Inventory
-- card (the /received grid): product_code and quantity_available.
--
-- Both are item ATTRIBUTES, not owner identity — the privacy guarantees of
-- safe_received_shares are unchanged:
--   * still OMITS original_owner_id and the original price (display_* keeps
--     the forward-price-wins logic);
--   * still joins only the SOURCE vendor's PUBLIC profile;
--   * quantity_available is already exposed to recipients by get_received_share
--     (the detail RPC), so the list view is now consistent with it.
--
-- CREATE OR REPLACE VIEW can only APPEND columns (Postgres forbids inserting
-- or reordering existing view columns), so 004's 21 columns are re-stated in
-- their exact original order and the two new fields are added at the end.
-- The RPC selects `*`, so column position is irrelevant to callers; the TS
-- client reads by name. security_invoker (set in 005) is re-asserted below so
-- the RLS-honoring behaviour is preserved.
-- ============================================================

CREATE OR REPLACE VIEW safe_received_shares AS
SELECT
  s.share_id,
  s.token,
  s.inventory_id,
  s.recipient_id,
  s.chain_depth,
  s.status,
  s.created_at,
  -- Source vendor's PUBLIC info only — never original_owner_id
  sv.id              AS shared_by_vendor_id,
  sv.company_name    AS shared_by_company_name,
  sv.logo_url        AS shared_by_logo_url,
  -- Effective price: forward override wins if present
  COALESCE(s.forward_price, i.price)       AS display_price,
  COALESCE(s.forward_currency, i.currency) AS display_currency,
  s.forward_remark,
  -- Inventory display fields (safe — these are meant to be seen)
  i.title, i.description, i.category, i.quantity, i.unit,
  i.origin, i.specs, i.status AS inventory_status,
  -- NEW (029): appended at the end to satisfy CREATE OR REPLACE VIEW.
  i.product_code, i.quantity_available
FROM shares s
JOIN vendors sv ON sv.id = s.source_vendor_id
JOIN inventory i ON i.inventory_id = s.inventory_id
WHERE s.status = 'active';

-- Preserve the RLS-honoring + access posture established in 005.
ALTER VIEW public.safe_received_shares SET (security_invoker = on);
REVOKE ALL ON public.safe_received_shares FROM anon;
GRANT SELECT ON public.safe_received_shares TO authenticated;
