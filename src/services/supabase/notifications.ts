import { supabase } from './client';

/**
 * Notifications service (Build Guide Step 29).
 *
 * RLS (notifications_own) scopes every query to the current vendor, so these
 * never need an explicit vendor_id filter. Rows are written by the various
 * SECURITY DEFINER action RPCs (share / reservation / negotiation flows).
 */

export interface AppNotification {
  notification_id: string;
  type: string;
  title: string;
  body: string | null;
  related_id: string | null;
  read: boolean;
  created_at: string;
}

/** All notifications for the current vendor, newest first. */
export async function getNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('notification_id, type, title, body, related_id, read, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

/** Count of unread notifications for the current vendor. */
export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('notification_id', { count: 'exact', head: true })
    .eq('read', false);
  if (error) throw error;
  return count ?? 0;
}

/** Mark a single notification read. */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('notification_id', notificationId);
  if (error) throw error;
}

/** Mark every unread notification read. */
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false);
  if (error) throw error;
}
