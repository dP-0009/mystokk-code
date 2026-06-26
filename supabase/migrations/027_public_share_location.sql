-- 027_public_share_location.sql
-- Surface the source vendor's city/country on the public share preview so the
-- link-unfurl endpoint (api/share/[token].ts) can build a richer OG description:
--   "{qty} {unit} from {company} • {city}, {country} • Powered by MyStokk".
-- This is the same already-public business identity as company_name/logo_url
-- (no original_owner_id or private field is exposed). Changing the RETURNS TABLE
-- signature requires DROP + recreate, which drops the anon grant, so we re-grant.

DROP FUNCTION IF EXISTS public.get_public_share(text);

CREATE FUNCTION public.get_public_share(p_token text)
  RETURNS TABLE(
    token text,
    chain_depth integer,
    status text,
    title text,
    description text,
    category text,
    quantity numeric,
    unit text,
    origin text,
    display_price numeric,
    display_currency text,
    forward_remark text,
    shared_by_company text,
    shared_by_logo_url text,
    shared_by_city text,
    shared_by_country text,
    has_recipient boolean
  )
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    s.token, s.chain_depth, s.status,
    i.title, i.description, i.category, i.quantity, i.unit, i.origin,
    COALESCE(s.forward_price, i.price) AS display_price,
    COALESCE(s.forward_currency, i.currency) AS display_currency,
    s.forward_remark,
    sv.company_name AS shared_by_company,
    sv.logo_url AS shared_by_logo_url,
    sv.city AS shared_by_city,
    sv.country AS shared_by_country,
    (s.recipient_id IS NOT NULL) AS has_recipient
  FROM shares s
  JOIN inventory i ON i.inventory_id = s.inventory_id
  JOIN vendors sv ON sv.id = s.source_vendor_id
  WHERE s.token = p_token AND s.status = 'active'
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_share(text) TO anon, authenticated;
