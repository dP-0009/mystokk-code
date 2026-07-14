import { useEffect, useRef } from 'react';
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

  // Per-mount suffix for the channel topic. supabase.channel() returns the
  // EXISTING channel for a topic it already has, so several components using
  // this hook at once (bell, profile menu, menu sheet, profile screen) would all
  // get one instance — and the second .on() after it subscribed throws
  // "cannot add postgres_changes callbacks after subscribe()". removeChannel()
  // also matches by topic, so a shared channel would be torn down by whichever
  // consumer unmounted first. A unique topic per mount gives each consumer its
  // own channel and its own clean teardown.
  const instanceId = useRef(Math.random().toString(36).slice(2)).current;

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
      .channel(`notifications:${userId}:${instanceId}`)
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
