-- The public share landing page now mirrors the signed-in Received Item detail:
-- a photo carousel, a "SKU • CATEGORY • age" subtitle, a Total Qty / Available
-- stat grid, and a packing-list card. That needs more than the single photo the
-- preview returned, so:
--
--   1. get_public_share gains product_code, item_created_at, quantity_available
--      and photo_paths (ALL photos, ordered). Signature changes → drop+recreate.
--      first_photo_path stays for the OG-image endpoint.
--   2. get_public_share_files lists the item's documents for an active share.
--      It returns storage PATHS only — the inventory-documents bucket is private,
--      so a path is not downloadable on its own. The public-doc Edge Function
--      exchanges (token, path) for a short-lived signed URL.

DROP FUNCTION IF EXISTS public.get_public_share(text);

CREATE FUNCTION public.get_public_share(p_token text)
 RETURNS TABLE(
   token text, chain_depth integer, status text,
   title text, description text, category text, product_code text,
   quantity numeric, quantity_available numeric, unit text,
   origin text, stock_location text,
   display_price numeric, display_currency text, forward_remark text,
   shared_by_company text, shared_by_logo_url text, shared_by_city text, shared_by_country text,
   first_photo_path text, photo_paths text[],
   item_created_at timestamptz,
   has_recipient boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    s.token, s.chain_depth, s.status,
    i.title, i.description, i.category, i.product_code,
    i.quantity, i.quantity_available, i.unit,
    i.origin, i.stock_location,
    COALESCE(s.forward_price, i.price) AS display_price,
    COALESCE(s.forward_currency, i.currency) AS display_currency,
    s.forward_remark,
    sv.company_name AS shared_by_company,
    sv.logo_url AS shared_by_logo_url,
    sv.city AS shared_by_city,
    sv.country AS shared_by_country,
    ph.paths[1] AS first_photo_path,
    COALESCE(ph.paths, ARRAY[]::text[]) AS photo_paths,
    i.created_at AS item_created_at,
    (s.recipient_id IS NOT NULL) AS has_recipient
  FROM shares s
  JOIN inventory i ON i.inventory_id = s.inventory_id
  JOIN vendors sv ON sv.id = s.source_vendor_id
  LEFT JOIN LATERAL (
    SELECT array_agg(ip.storage_path ORDER BY ip.sort_order ASC, ip.uploaded_at ASC) AS paths
    FROM inventory_photos ip
    WHERE ip.inventory_id = s.inventory_id
  ) ph ON TRUE
  WHERE s.token = p_token AND s.status = 'active'
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_share(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_share_files(p_token text)
 RETURNS TABLE(name text, storage_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT f.original_name AS name, f.storage_path
  FROM shares s
  JOIN inventory_files f ON f.inventory_id = s.inventory_id
  WHERE s.token = p_token AND s.status = 'active'
  ORDER BY f.uploaded_at ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_share_files(text) TO anon, authenticated;
