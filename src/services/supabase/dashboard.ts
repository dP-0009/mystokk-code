import { supabase } from './client';

export interface DashboardStats {
  inventory: number;
  received: number;
  reservations: number;
  network: number;
}

export interface PendingReservation {
  reservation_id: string;
  quantity: number;
  offered_price: number | null;
  requester_company: string | null;
  requester_contact: string | null;
  item_title: string;
  item_currency: string;
  item_price: number | null;
}

export interface ReceivedItem {
  share_id: string;
  title: string;
  shared_by_company_name: string | null;
  display_price: number | null;
  display_currency: string | null;
  created_at: string;
}

export interface DashboardData {
  vendor: { companyName: string | null; contactPerson: string | null };
  stats: DashboardStats;
  pending: PendingReservation[];
  received: ReceivedItem[];
}

/**
 * One batched fetch for the whole dashboard. Counts rely on RLS to scope rows
 * to the current vendor; the two lists use SECURITY DEFINER RPCs so the
 * counterparty's public fields are visible (vendors RLS is self-only).
 */
export async function getDashboardData(): Promise<DashboardData> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const [vendorRes, invRes, recvCountRes, resRes, connRes, manRes, pendingRes, recvRes] =
    await Promise.all([
      supabase.from('vendors').select('company_name, contact_person').eq('id', user.id).single(),
      supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('vendor_id', user.id),
      supabase
        .from('shares')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('status', 'active'),
      // RLS scopes reservations to ones the vendor is party to.
      supabase.from('reservations').select('*', { count: 'exact', head: true }),
      supabase.from('connections').select('*', { count: 'exact', head: true }).eq('status', 'connected'),
      supabase.from('manual_vendors').select('*', { count: 'exact', head: true }),
      supabase.rpc('get_incoming_reservations', { p_limit: 3 }),
      supabase.rpc('get_received_shares', { p_vendor_id: user.id }),
    ]);

  const firstError =
    invRes.error ??
    recvCountRes.error ??
    resRes.error ??
    connRes.error ??
    manRes.error ??
    pendingRes.error ??
    recvRes.error;
  if (firstError) throw firstError;

  const vendorRow = (vendorRes.data ?? null) as
    | { company_name: string | null; contact_person: string | null }
    | null;

  const received3 = ((recvRes.data ?? []) as ReceivedItem[])
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 3);

  return {
    vendor: {
      companyName: vendorRow?.company_name ?? null,
      contactPerson: vendorRow?.contact_person ?? null,
    },
    stats: {
      inventory: invRes.count ?? 0,
      received: recvCountRes.count ?? 0,
      reservations: resRes.count ?? 0,
      network: (connRes.count ?? 0) + (manRes.count ?? 0),
    },
    pending: (pendingRes.data ?? []) as PendingReservation[],
    received: received3,
  };
}
