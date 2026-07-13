import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase/client';
import { getUnreadCount } from '../services/supabase/notifications';
import { useAuthStore } from '../stores/authStore';

export const UNREAD_COUNT_KEY = ['unreadCount'] as const;

/**
 * Live unread-notification count for the current vendor. Backs the nav badges
 * (documented /sidebar/counts pattern). A Supabase Realtime subscription on the
 * notifications table — filtered to this vendor, RLS-scoped — invalidates the
 * count + list on any insert/update, so badges refresh without polling.
 */
export function useUnreadCount(): number {
  const queryClient = useQueryClient();
  // Stable, synchronous user id from the auth store — drives the subscription
  // lifecycle so the effect can build + tear down the channel without an async gap.
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data } = useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: getUnreadCount,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!userId) return;

    // Attach the postgres_changes handler BEFORE subscribe(), in one synchronous
    // chain. Supabase rejects .on() on an already-subscribed channel, so this must
    // never be deferred behind an await — otherwise a re-render/hot-reload can run
    // this effect against a channel the previous run already subscribed.
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `vendor_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    // Tear the channel down on unmount and before every re-run, so the next run
    // always builds a fresh, unsubscribed channel.
    return () => {
      void supabase.removeChannel(channel);
    };
    // queryClient is a stable singleton; re-subscribe only when the identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return data ?? 0;
}
