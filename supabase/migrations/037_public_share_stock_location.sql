-- Add stock_location to the public share preview so the share landing page can
-- show "Stock Location" above the Category line. Return signature changes, so
-- drop + recreate.
DROP FUNCTION IF EXISTS public.get_public_share(text);

CREATE FUNCTION public.get_public_share(p_token text)
 RETURNS TABLE(token text, chain_depth integer, status text, title text, description text, category text, quantity numeric, unit text, origin text, stock_location text, display_price numeric, display_currency text, forward_remark text, shared_by_company text, shared_by_logo_url text, shared_by_city text, shared_by_country text, first_photo_path text, has_recipient boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    s.token, s.chain_depth, s.status,
    i.title, i.description, i.category, i.quantity, i.unit, i.origin, i.stock_location,
    COALESCE(s.forward_price, i.price) AS display_price,
    COALESCE(s.forward_currency, i.currency) AS display_currency,
    s.forward_remark,
    sv.company_name AS shared_by_company,
    sv.logo_url AS shared_by_logo_url,
    sv.city AS shared_by_city,
    sv.country AS shared_by_country,
    ph.storage_path AS first_photo_path,
    (s.recipient_id IS NOT NULL) AS has_recipient
  FROM shares s
  JOIN inventory i ON i.inventory_id = s.inventory_id
  JOIN vendors sv ON sv.id = s.source_vendor_id
  LEFT JOIN LATERAL (
    SELECT ip.storage_path
    FROM inventory_photos ip
    WHERE ip.inventory_id = s.inventory_id
    ORDER BY ip.sort_order ASC, ip.uploaded_at ASC
    LIMIT 1
  ) ph ON TRUE
  WHERE s.token = p_token AND s.status = 'active'
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_share(text) TO anon, authenticated;
