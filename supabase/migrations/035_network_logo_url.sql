-- ============================================================
-- 035_network_logo_url.sql
-- Surfaces each counterparty vendor's company logo on the network screens so
-- the My Network table / Share modal vendor list / View Vendor popup can show
-- the real logo (falling back to the colored letter-initial circle when null).
--
-- logo_url is a PUBLIC profile field (already exposed by get_vendor_profile,
-- migration 013) — no new privacy surface. Connected vendors use the joined
-- vendor's logo; manual contacts use their linked registered vendor's logo when
-- one exists, else null (unregistered manual contacts have no logo).
--
-- The RETURNS TABLE signature changes, so each function is DROP'd then re-created
-- (Postgres forbids changing a function's return type via CREATE OR REPLACE).
-- ============================================================

-- ------------------------------------------------------------
-- get_network() — append logo_url.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_network();
CREATE OR REPLACE FUNCTION public.get_network()
RETURNS TABLE (
  row_id         uuid,
  source         text,
  vendor_id      uuid,
  company_name   text,
  contact_person text,
  email          text,
  mobile_number  text,
  industry       text,
  country        text,
  city           text,
  group_name     text,
  is_manual      boolean,
  is_registered  boolean,
  status         text,
  created_at     timestamptz,
  logo_url       text
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT * FROM (
    -- Connected vendors (caller may be on either side of the row)
    SELECT
      c.connection_id AS row_id,
      'connection'    AS source,
      other.id        AS vendor_id,
      other.company_name,
      other.contact_person,
      other.email,
      other.mobile_number,
      other.industry,
      other.country,
      other.city,
      c.group_name,
      false           AS is_manual,
      true            AS is_registered,
      c.status,
      c.created_at,
      other.logo_url
    FROM connections c
    JOIN vendors other
      ON other.id = CASE WHEN c.vendor_id = auth.uid() THEN c.connected_vendor_id ELSE c.vendor_id END
    WHERE (c.vendor_id = auth.uid() OR c.connected_vendor_id = auth.uid())
      AND c.status = 'connected'

    UNION ALL

    -- Manual contacts I own (logo via their linked registered vendor, if any)
    SELECT
      m.id              AS row_id,
      'manual'          AS source,
      m.linked_vendor_id AS vendor_id,
      m.company_name,
      m.contact_person,
      m.email,
      m.mobile_number,
      m.industry,
      m.country,
      m.city,
      m.group_name,
      true              AS is_manual,
      COALESCE(m.is_registered, false) AS is_registered,
      'connected'       AS status,
      m.created_at,
      lv.logo_url
    FROM manual_vendors m
    LEFT JOIN vendors lv ON lv.id = m.linked_vendor_id
    WHERE m.owner_vendor_id = auth.uid()
  ) unified
  ORDER BY company_name;
$$;
REVOKE ALL ON FUNCTION public.get_network() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_network() TO authenticated;

-- ------------------------------------------------------------
-- get_pending_connections() — append logo_url.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_pending_connections();
CREATE OR REPLACE FUNCTION public.get_pending_connections()
RETURNS TABLE (
  connection_id  uuid,
  vendor_id      uuid,
  company_name   text,
  contact_person text,
  email          text,
  mobile_number  text,
  industry       text,
  country        text,
  city           text,
  created_at     timestamptz,
  logo_url       text
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT
    c.connection_id,
    req.id,
    req.company_name,
    req.contact_person,
    req.email,
    req.mobile_number,
    req.industry,
    req.country,
    req.city,
    c.created_at,
    req.logo_url
  FROM connections c
  JOIN vendors req ON req.id = c.vendor_id
  WHERE c.connected_vendor_id = auth.uid()
    AND c.status = 'pending'
  ORDER BY c.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_pending_connections() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_pending_connections() TO authenticated;
