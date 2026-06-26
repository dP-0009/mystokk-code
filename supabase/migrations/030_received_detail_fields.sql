-- ============================================================
-- 030_received_detail_fields.sql
-- Enriches get_received_share for the rebuilt Received Inventory Detail page.
-- Adds, on top of 018's columns:
--   product_code    — item SKU (already exposed on the list card in 029)
--   stock_location  — where the goods sit (user-approved exposure; item offer
--                     data the owner chose to share)
--   contact_person  — the SOURCE vendor's contact (the hop the recipient sees
--                     as "Shared by" — never the original owner past depth 0)
--   shared_with     — how many parties THIS recipient forwarded the share to
--                     (children of this share; only the holder can forward it)
--   photos          — jsonb array of inventory_photos storage_paths (<=5)
--   files           — jsonb array of {path,name} from inventory_files
--
-- Privacy unchanged: still joins only the source vendor's row (sv), still omits
-- original_owner_id + original price (display_* keeps forward-price-wins). The
-- photo/file PATHS are returned by this SECURITY DEFINER fn (past RLS); the
-- client turns them into short-lived signed URLs, which the recipient is
-- entitled to by the 009 storage policies (active share on the inventory).
--
-- Adding OUT columns changes the return type, so DROP first (per 018's note).
-- ============================================================

DROP FUNCTION IF EXISTS public.get_received_share(uuid);
CREATE OR REPLACE FUNCTION public.get_received_share(p_share_id uuid)
RETURNS TABLE (
  share_id           uuid,
  token              text,
  inventory_id       uuid,
  chain_depth        int,
  status             text,
  created_at         timestamptz,
  shared_by_company  text,
  shared_by_logo_url text,
  display_price      numeric,
  display_currency   text,
  forward_remark     text,
  title              text,
  description        text,
  category           text,
  quantity           numeric,
  quantity_available numeric,
  unit               text,
  origin             text,
  specs              jsonb,
  inventory_status   text,
  reserved_by_me     numeric,
  available_to_me    numeric,
  product_code       text,
  stock_location     text,
  contact_person     text,
  shared_with        int,
  photos             jsonb,
  files              jsonb
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT
    s.share_id, s.token, s.inventory_id, s.chain_depth, s.status, s.created_at,
    sv.company_name AS shared_by_company,
    sv.logo_url     AS shared_by_logo_url,
    COALESCE(s.forward_price, i.price)       AS display_price,
    COALESCE(s.forward_currency, i.currency) AS display_currency,
    s.forward_remark,
    i.title, i.description, i.category, i.quantity, i.quantity_available, i.unit, i.origin,
    i.specs, i.status AS inventory_status,
    COALESCE((
      SELECT SUM(r.quantity) FROM reservations r
      WHERE r.share_id = s.share_id AND r.requester_id = auth.uid() AND r.status = 'confirmed'
    ), 0) AS reserved_by_me,
    GREATEST(
      i.quantity_available - COALESCE((
        SELECT SUM(r.quantity) FROM reservations r
        WHERE r.inventory_id = s.inventory_id AND r.share_id <> s.share_id
          AND r.status IN ('pending', 'negotiating')
      ), 0),
      0
    ) AS available_to_me,
    -- NEW (030)
    i.product_code,
    i.stock_location,
    sv.contact_person AS contact_person,
    COALESCE((
      SELECT COUNT(*) FROM shares c
      WHERE c.parent_share_id = s.share_id AND c.status = 'active'
    ), 0)::int AS shared_with,
    COALESCE((
      SELECT jsonb_agg(ph.storage_path ORDER BY ph.sort_order)
      FROM (
        SELECT storage_path, sort_order FROM inventory_photos
        WHERE inventory_id = s.inventory_id
        ORDER BY sort_order ASC LIMIT 5
      ) ph
    ), '[]'::jsonb) AS photos,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('path', f.storage_path, 'name', f.original_name) ORDER BY f.uploaded_at)
      FROM inventory_files f WHERE f.inventory_id = s.inventory_id
    ), '[]'::jsonb) AS files
  FROM shares s
  JOIN inventory i ON i.inventory_id = s.inventory_id
  JOIN vendors sv  ON sv.id = s.source_vendor_id
  WHERE s.share_id = p_share_id
    AND s.recipient_id = auth.uid()
    AND s.status = 'active'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_received_share(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_received_share(uuid) TO authenticated;
