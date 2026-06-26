-- ============================================================
-- 033_received_card_thumbnail.sql
-- Surfaces the item's FIRST product photo on the Received Inventory card
-- (the /received grid), so each card shows a real thumbnail instead of the
-- grey cube placeholder.
--
-- first_photo_path is the storage_path of the lowest sort_order photo (same
-- selection the public OG card uses in get_public_share, migration 028). The
-- service signs it for display via the recipient-read storage policy (009).
--
-- Privacy unchanged: a photo is item visual ID (safe to expose), exactly like
-- the public share card. The view still OMITS original_owner_id and the raw
-- original price (display_* keeps forward-price-wins), and still joins only the
-- SOURCE vendor's PUBLIC profile.
--
-- CREATE OR REPLACE VIEW can only APPEND columns (Postgres forbids inserting or
-- reordering existing view columns), so 029's 23 columns are re-stated in their
-- exact order and first_photo_path is appended at the end. The RPC selects `*`,
-- so column position is irrelevant to callers; the TS client reads by name.
-- security_invoker (set in 005) is re-asserted so RLS behaviour is preserved.
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
  i.product_code, i.quantity_available,
  -- NEW (031): first photo's storage path, appended at the end.
  ph.storage_path AS first_photo_path
FROM shares s
JOIN vendors sv ON sv.id = s.source_vendor_id
JOIN inventory i ON i.inventory_id = s.inventory_id
LEFT JOIN LATERAL (
  SELECT ip.storage_path
  FROM inventory_photos ip
  WHERE ip.inventory_id = s.inventory_id
  ORDER BY ip.sort_order ASC, ip.uploaded_at ASC
  LIMIT 1
) ph ON TRUE
WHERE s.status = 'active';

-- Preserve the RLS-honoring + access posture established in 005.
ALTER VIEW public.safe_received_shares SET (security_invoker = on);
REVOKE ALL ON public.safe_received_shares FROM anon;
GRANT SELECT ON public.safe_received_shares TO authenticated;
