import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase/client';
import { countReservationsAwaitingMe } from '../services/supabase/reservations';
import { useAuthStore } from '../stores/authStore';

export const RESERVATION_ATTENTION_KEY = ['reservationAttention'] as const;

/**
 * Live count of reservations awaiting the current vendor's response — a fresh
 * incoming request, or a negotiation where the other party moved last. Backs
 * the sidebar Reservation Hub red dot.
 *
 * Every reserve / counter / accept writes a notification row to the affected
 * vendor, and that table is already in the Realtime publication, so we reuse
 * the same signal: any notification change for me re-fetches the count without
 * polling. The reservation list caches are invalidated too so the hub stays in
 * sync if it's open.
 */
export function useReservationAttention(): number {
  const queryClient = useQueryClient();
  // Stable, synchronous user id from the auth store — drives the subscription
  // lifecycle so the effect can build + tear down the channel without an async gap.
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data } = useQuery({
    queryKey: RESERVATION_ATTENTION_KEY,
    queryFn: countReservationsAwaitingMe,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!userId) return;

    // Attach the postgres_changes handler BEFORE subscribe(), in one synchronous
    // chain. Supabase rejects .on() on an already-subscribed channel, so this must
    // never be deferred behind an await — otherwise a re-render/hot-reload can run
    // this effect against a channel the previous run already subscribed.
    const channel = supabase
      .channel(`reservation-attention:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `vendor_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: RESERVATION_ATTENTION_KEY });
          void queryClient.invalidateQueries({ queryKey: ['reservations'] });
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
