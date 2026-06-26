-- ============================================================
-- 013_network_rpcs.sql
-- Network screens (Build Guide §6.5 / Step 20).
--
-- vendors RLS is self-only (vendors_self), so a vendor cannot read a
-- counterparty's row directly. These SECURITY DEFINER RPCs expose ONLY the
-- public profile fields of vendors the caller is actually connected to (or who
-- sent them a pending request), scoped to auth.uid().
--
-- Accept / Reject / Remove of a connection are plain UPDATE/DELETE done from
-- the client — connections_own RLS already permits them (auth.uid() is either
-- side of the row). No RPC needed for those.
-- ============================================================

-- ------------------------------------------------------------
-- Unified network list: connected connections + manual_vendors.
-- Matches the documented /network/all behavior. A row is shown with a MANUAL
-- badge when is_manual = true AND is_registered = false.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_network()
RETURNS TABLE (
  row_id         uuid,    -- connection_id (connections) or manual_vendors.id
  source         text,    -- 'connection' | 'manual'
  vendor_id      uuid,    -- counterparty vendor id (null for an unregistered manual contact)
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
  created_at     timestamptz
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
      c.created_at
    FROM connections c
    JOIN vendors other
      ON other.id = CASE WHEN c.vendor_id = auth.uid() THEN c.connected_vendor_id ELSE c.vendor_id END
    WHERE (c.vendor_id = auth.uid() OR c.connected_vendor_id = auth.uid())
      AND c.status = 'connected'

    UNION ALL

    -- Manual contacts I own
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
      m.created_at
    FROM manual_vendors m
    WHERE m.owner_vendor_id = auth.uid()
  ) unified
  ORDER BY company_name;
$$;
REVOKE ALL ON FUNCTION public.get_network() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_network() TO authenticated;

-- ------------------------------------------------------------
-- Incoming connection requests (connections.status = 'pending' where the
-- caller is the addressee). The caller can Accept (→ connected) or Reject.
-- ------------------------------------------------------------
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
  created_at     timestamptz
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
    c.created_at
  FROM connections c
  JOIN vendors req ON req.id = c.vendor_id
  WHERE c.connected_vendor_id = auth.uid()
    AND c.status = 'pending'
  ORDER BY c.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_pending_connections() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_pending_connections() TO authenticated;

-- ------------------------------------------------------------
-- Look up a registered vendor by email (case-insensitive) — used by the manual
-- Add Vendor flow to decide auto-connect vs. save-as-manual. Returns only the
-- id + company name, and never the caller's own row.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_vendor_by_email(p_email text)
RETURNS TABLE (vendor_id uuid, company_name text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT id, company_name
  FROM vendors
  WHERE LOWER(email) = LOWER(TRIM(p_email))
    AND id <> auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_vendor_by_email(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.find_vendor_by_email(text) TO authenticated;

-- ------------------------------------------------------------
-- Counterparty profile + activity for the Vendor Detail screen. Only returns a
-- vendor the caller is connected to or has a pending edge with.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vendor_profile(p_vendor_id uuid)
RETURNS TABLE (
  vendor_id           uuid,
  company_name        text,
  contact_person      text,
  email               text,
  mobile_number       text,
  industry            text,
  country             text,
  city                text,
  logo_url            text,
  connection_id       uuid,
  status              text,
  group_name          text,
  connected_since     timestamptz,
  shared_with_count   integer,
  received_from_count integer
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  SELECT
    v.id,
    v.company_name,
    v.contact_person,
    v.email,
    v.mobile_number,
    v.industry,
    v.country,
    v.city,
    v.logo_url,
    c.connection_id,
    c.status,
    c.group_name,
    c.created_at AS connected_since,
    (SELECT COUNT(*)::int FROM shares s
       WHERE s.source_vendor_id = auth.uid() AND s.recipient_id = p_vendor_id),
    (SELECT COUNT(*)::int FROM shares s
       WHERE s.recipient_id = auth.uid() AND s.source_vendor_id = p_vendor_id)
  FROM vendors v
  LEFT JOIN connections c
    ON (c.vendor_id = auth.uid() AND c.connected_vendor_id = p_vendor_id)
    OR (c.connected_vendor_id = auth.uid() AND c.vendor_id = p_vendor_id)
  WHERE v.id = p_vendor_id
    AND EXISTS (
      SELECT 1 FROM connections cc
      WHERE (cc.vendor_id = auth.uid() AND cc.connected_vendor_id = p_vendor_id)
         OR (cc.connected_vendor_id = auth.uid() AND cc.vendor_id = p_vendor_id)
    )
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_vendor_profile(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_vendor_profile(uuid) TO authenticated;

-- ------------------------------------------------------------
-- CSV bulk import. Dedupes by email (case-insensitive) within the payload AND
-- against the caller's existing manual contacts / connections. Each unique row:
--   - email matches a registered vendor  → create a connected connections row
--   - otherwise                          → create a manual_vendors row (is_registered=false)
-- Returns { imported, duplicates }.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_import_vendors(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me         uuid := auth.uid();
  rec        jsonb;
  v_company  text;
  v_email    text;
  v_match    uuid;
  imported   int := 0;
  duplicates int := 0;
  seen       text[] := '{}';
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_company := TRIM(COALESCE(rec->>'company_name', ''));
    v_email   := LOWER(TRIM(COALESCE(rec->>'email', '')));

    -- A company name is required; skip empty rows silently.
    IF v_company = '' THEN
      CONTINUE;
    END IF;

    -- Dedupe within the uploaded file by email.
    IF v_email <> '' AND v_email = ANY(seen) THEN
      duplicates := duplicates + 1;
      CONTINUE;
    END IF;
    IF v_email <> '' THEN
      seen := array_append(seen, v_email);
    END IF;

    -- Already saved as a manual contact?
    IF v_email <> '' AND EXISTS (
      SELECT 1 FROM manual_vendors m
      WHERE m.owner_vendor_id = me AND LOWER(m.email) = v_email
    ) THEN
      duplicates := duplicates + 1;
      CONTINUE;
    END IF;

    -- Match a registered vendor by email.
    v_match := NULL;
    IF v_email <> '' THEN
      SELECT id INTO v_match FROM vendors WHERE LOWER(email) = v_email AND id <> me LIMIT 1;
    END IF;

    IF v_match IS NOT NULL THEN
      -- Auto-connect, unless an edge already exists in either direction.
      IF EXISTS (
        SELECT 1 FROM connections c
        WHERE (c.vendor_id = me AND c.connected_vendor_id = v_match)
           OR (c.vendor_id = v_match AND c.connected_vendor_id = me)
      ) THEN
        duplicates := duplicates + 1;
        CONTINUE;
      END IF;
      INSERT INTO connections (vendor_id, connected_vendor_id, status, group_name)
      VALUES (me, v_match, 'connected', NULLIF(TRIM(COALESCE(rec->>'group_name', '')), ''));
      imported := imported + 1;
    ELSE
      INSERT INTO manual_vendors (
        owner_vendor_id, company_name, contact_person, email, mobile_number,
        industry, country, city, group_name, is_registered
      ) VALUES (
        me, v_company,
        NULLIF(TRIM(COALESCE(rec->>'contact_person', '')), ''),
        NULLIF(v_email, ''),
        NULLIF(TRIM(COALESCE(rec->>'mobile_number', '')), ''),
        NULLIF(TRIM(COALESCE(rec->>'industry', '')), ''),
        NULLIF(TRIM(COALESCE(rec->>'country', '')), ''),
        NULLIF(TRIM(COALESCE(rec->>'city', '')), ''),
        NULLIF(TRIM(COALESCE(rec->>'group_name', '')), ''),
        false
      );
      imported := imported + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('imported', imported, 'duplicates', duplicates);
END;
$$;
REVOKE ALL ON FUNCTION public.bulk_import_vendors(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.bulk_import_vendors(jsonb) TO authenticated;
