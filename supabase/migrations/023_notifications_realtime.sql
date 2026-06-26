-- ============================================================
-- 023_notifications_realtime.sql
-- Live notification badges (Build Guide Step 29).
--
-- Add the notifications table to the supabase_realtime publication so the
-- client can subscribe to inserts/updates and refresh badge counts without
-- polling. RLS (notifications_own) still applies to realtime, so each vendor
-- only receives change events for their OWN rows.
-- REPLICA IDENTITY FULL so UPDATE/DELETE events carry the row's vendor_id for
-- the client-side filter.
-- ============================================================

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
