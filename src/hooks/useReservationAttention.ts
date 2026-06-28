import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabase/client';
import { countReservationsAwaitingMe } from '../services/supabase/reservations';

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

  const { data } = useQuery({
    queryKey: RESERVATION_ATTENTION_KEY,
    queryFn: countReservationsAwaitingMe,
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
        .channel(`reservation-attention:${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `vendor_id=eq.${user.id}` },
          () => {
            void queryClient.invalidateQueries({ queryKey: RESERVATION_ATTENTION_KEY });
            void queryClient.invalidateQueries({ queryKey: ['reservations'] });
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
