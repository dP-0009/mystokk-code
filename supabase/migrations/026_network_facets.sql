-- ============================================================
-- 026_network_facets.sql
-- Real distinct-value source for the Industry / Country / Group filter
-- dropdowns (Build Guide Step 32 — the GET-groups equivalent). vendors RLS is
-- self-only, so the connected counterparties' industry/country must come from a
-- SECURITY DEFINER RPC scoped to auth.uid(). Mirrors get_network()'s union.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_network_facets()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
  WITH net AS (
    SELECT other.industry, other.country, c.group_name
    FROM connections c
    JOIN vendors other
      ON other.id = CASE WHEN c.vendor_id = auth.uid() THEN c.connected_vendor_id ELSE c.vendor_id END
    WHERE (c.vendor_id = auth.uid() OR c.connected_vendor_id = auth.uid()) AND c.status = 'connected'
    UNION ALL
    SELECT m.industry, m.country, m.group_name
    FROM manual_vendors m
    WHERE m.owner_vendor_id = auth.uid()
  )
  SELECT jsonb_build_object(
    'industries', COALESCE((SELECT jsonb_agg(DISTINCT industry ORDER BY industry) FROM net WHERE industry IS NOT NULL AND industry <> ''), '[]'::jsonb),
    'countries',  COALESCE((SELECT jsonb_agg(DISTINCT country  ORDER BY country)  FROM net WHERE country  IS NOT NULL AND country  <> ''), '[]'::jsonb),
    'groups',     COALESCE((SELECT jsonb_agg(DISTINCT group_name ORDER BY group_name) FROM net WHERE group_name IS NOT NULL AND group_name <> ''), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.get_network_facets() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_network_facets() TO authenticated;
