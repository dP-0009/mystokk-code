-- ============================================================
-- 025_profile_settings.sql
-- Profile / Settings (Build Guide Step 31): notification preferences + account
-- deletion.
-- ============================================================

-- ---- Notification preferences (one row per vendor) ---------------------------
CREATE TABLE IF NOT EXISTS public.vendor_preferences (
  vendor_id           uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  new_shares          boolean NOT NULL DEFAULT true,
  reservation_updates boolean NOT NULL DEFAULT true,
  network_invites     boolean NOT NULL DEFAULT false,  -- off by default (prototype)
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_preferences_own ON public.vendor_preferences;
CREATE POLICY vendor_preferences_own ON public.vendor_preferences
  FOR ALL USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);

-- ---- Delete account ----------------------------------------------------------
-- Removes everything the caller owns/touches in FK-safe order, then the auth
-- user (which cascades vendors + vendor_preferences). SECURITY DEFINER so it can
-- reach auth.users and cross-vendor rows that reference the caller.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Other vendors' manual contacts that auto-linked to me → unlink.
  UPDATE manual_vendors SET linked_vendor_id = NULL, is_registered = false WHERE linked_vendor_id = me;

  -- Orphan downstream forwards that point at my shares (so deleting mine is safe).
  UPDATE shares SET parent_share_id = NULL
  WHERE parent_share_id IN (
    SELECT share_id FROM shares WHERE original_owner_id = me OR source_vendor_id = me OR recipient_id = me
  );

  -- Reservations touching my data (cascades negotiation_rounds).
  DELETE FROM reservations
  WHERE requester_id = me OR responder_id = me
     OR inventory_id IN (SELECT inventory_id FROM inventory WHERE vendor_id = me)
     OR share_id IN (SELECT share_id FROM shares WHERE original_owner_id = me OR source_vendor_id = me OR recipient_id = me);

  -- Shares I'm party to + any share of my items (whole chain for my inventory).
  DELETE FROM shares
  WHERE original_owner_id = me OR source_vendor_id = me OR recipient_id = me
     OR inventory_id IN (SELECT inventory_id FROM inventory WHERE vendor_id = me);

  DELETE FROM connections WHERE vendor_id = me OR connected_vendor_id = me;
  DELETE FROM manual_vendors WHERE owner_vendor_id = me;
  DELETE FROM notifications WHERE vendor_id = me;
  DELETE FROM conversations WHERE vendor_a_id = me OR vendor_b_id = me;  -- cascades messages
  DELETE FROM inventory WHERE vendor_id = me;  -- cascades inventory_photos/files

  -- Finally the auth user → cascades vendors + vendor_preferences.
  DELETE FROM auth.users WHERE id = me;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
