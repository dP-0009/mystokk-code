import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabase/client';
import { getUnreadCount } from '../services/supabase/notifications';

export const UNREAD_COUNT_KEY = ['unreadCount'] as const;

/**
 * Live unread-notification count for the current vendor. Backs the nav badges
 * (documented /sidebar/counts pattern). A Supabase Realtime subscription on the
 * notifications table — filtered to this vendor, RLS-scoped — invalidates the
 * count + list on any insert/update, so badges refresh without polling.
 */
export function useUnreadCount(): number {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: getUnreadCount,
    staleTime: 30_000,
  });

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `vendor_id=eq.${user.id}` },
          () => {
            void queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return data ?? 0;
}
