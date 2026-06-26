-- ============================================================
-- 024_push_notifications.sql
-- Remote push (Build Guide Step 30). A database webhook: every INSERT into
-- notifications fires the send-push Edge Function (async, via pg_net), which
-- looks up the vendor's FCM token and delivers the push.
--
-- The client stores its FCM token on its own vendor row (vendors_self RLS
-- allows the owner to UPDATE), so no extra write RPC is needed.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS push_token            text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS push_platform         text;   -- 'ios' | 'android'
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS push_token_updated_at timestamptz;

-- Fire the Edge Function on every new notification row. Non-blocking: pg_net
-- queues the request and returns immediately, so notification writes stay fast.
-- The function is deployed with verify_jwt=false (DB-webhook pattern) and uses
-- the service role internally; for production, prefer the dashboard Database
-- Webhook with a signing secret.
CREATE OR REPLACE FUNCTION public.notify_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://gjpzgdrmfxiwqfijaizb.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'notification_id', NEW.notification_id,
      'vendor_id',       NEW.vendor_id,
      'type',            NEW.type,
      'title',           NEW.title,
      'body',            NEW.body,
      'related_id',      NEW.related_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_push ON public.notifications;
CREATE TRIGGER notifications_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notify_push();
