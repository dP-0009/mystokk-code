-- ============================================================
-- 005_privacy_hardening.sql
-- Closes privacy holes flagged by the Supabase security advisor after
-- 001-004 were applied:
--   * security_definer_view (ERROR) -> the 'Unrestricted' badge on
--     safe_received_shares (it ran as the creator, bypassing RLS, and
--     was readable by anon + every authenticated vendor = full leak of
--     every active share in the system).
--   * get_received_shares trusted a client-supplied p_vendor_id AND was
--     callable by anon -> anyone could read any vendor's received shares.
--   * mutable search_path on SECURITY DEFINER / trigger functions.
-- ============================================================

-- 1) View now honors the querying user's RLS (clears the ERROR / badge).
ALTER VIEW public.safe_received_shares SET (security_invoker = on);

-- 2) Anonymous (logged-out) callers get no access to the view at all.
REVOKE ALL ON public.safe_received_shares FROM anon;

-- 3) RPC now filters by the AUTHENTICATED caller (auth.uid()), never the
--    client-supplied id. Signature kept for call-site compatibility;
--    p_vendor_id is ignored on purpose. SECURITY DEFINER lets the internal
--    joins read across tables; auth.uid() still reflects the real caller.
CREATE OR REPLACE FUNCTION public.get_received_shares(p_vendor_id uuid)
RETURNS SETOF public.safe_received_shares
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.safe_received_shares WHERE recipient_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_received_shares(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_received_shares(uuid) TO authenticated;

-- 4) Pin search_path on every SECURITY DEFINER / trigger function.
ALTER FUNCTION public.handle_new_auth_user()            SET search_path = public, pg_temp;
ALTER FUNCTION public.link_manual_vendor_on_signup()    SET search_path = public, pg_temp;
ALTER FUNCTION public.check_negotiation_cap()           SET search_path = public, pg_temp;
ALTER FUNCTION public.update_profile_complete()         SET search_path = public, pg_temp;
ALTER FUNCTION public.update_inventory_status()         SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_profile_complete(public.vendors) SET search_path = public, pg_temp;
