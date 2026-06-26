-- ============================================================
-- 006_lock_trigger_functions.sql
-- Trigger/helper functions must never be invokable as PostgREST RPCs.
-- Revoking EXECUTE does NOT stop triggers from firing (the trigger
-- mechanism runs them as the owner regardless of grants).
-- ============================================================
REVOKE ALL ON FUNCTION public.handle_new_auth_user()                 FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.link_manual_vendor_on_signup()         FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.check_negotiation_cap()                FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_profile_complete()              FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_inventory_status()              FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.calculate_profile_complete(public.vendors) FROM anon, authenticated, public;
