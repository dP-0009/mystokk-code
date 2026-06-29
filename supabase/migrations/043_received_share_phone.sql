-- Add the sharer's phone to the received-share detail so the "Shared By" panel
-- can offer call + WhatsApp actions alongside email. Return signature changes →
-- drop + recreate. Still privacy-safe: only the source vendor's public contact
-- fields are exposed (never original_owner_id or the raw original price).
DROP FUNCTION IF EXISTS public.get_received_share(uuid);

CREATE FUNCTION public.get_received_share(p_share_id uuid)
 RETURNS TABLE(share_id uuid, token text, inventory_id uuid, chain_depth integer, status text, created_at timestamp with time zone, shared_by_company text, shared_by_logo_url text, display_price numeric, display_currency text, forward_remark text, title text, description text, category text, quantity numeric, quantity_available numeric, unit text, origin text, specs jsonb, inventory_status text, reserved_by_me numeric, available_to_me numeric, product_code text, stock_location text, contact_person text, shared_by_email text, shared_by_phone text, shared_with integer, photos jsonb, files jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    i.product_code,
    i.stock_location,
    sv.contact_person AS contact_person,
    sv.email AS shared_by_email,
    sv.mobile_number AS shared_by_phone,
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
$function$;

GRANT EXECUTE ON FUNCTION public.get_received_share(uuid) TO authenticated;
