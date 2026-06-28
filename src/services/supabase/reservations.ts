import { supabase } from './client';
import { toFullUrl } from './storage';

/**
 * Reservations service. Accept/Reject power the Dashboard inline actions;
 * createReservation is used by the Received Detail "Reserve" sheet. Negotiation
 * / pass-to-supplier arrive in the Reservations phase.
 */

/**
 * Reserve against a received share (Spec §6.2). The RPC validates the quantity
 * against what's available to this vendor, sets responder = the share's
 * source_vendor_id, writes the reservation (status='pending'), and notifies the
 * responder. We then fire the reservation-request email best-effort.
 */
export async function createReservation(
  inventoryId: string,
  shareId: string,
  quantity: number,
  offeredPrice: number | null,
  message: string | null,
): Promise<void> {
  const { data, error } = await supabase.rpc('create_reservation', {
    p_inventory_id: inventoryId,
    p_share_id: shareId,
    p_quantity: quantity,
    p_offered_price: offeredPrice,
    p_message: message,
  });
  if (error) throw error;

  const reservationId = data as string;
  try {
    await supabase.functions.invoke('send-email', {
      body: { type: 'reservation_request', reservationId },
    });
  } catch {
    // Notification email is best-effort — the in-app notification is the source of truth.
  }
}

export interface IncomingReservation {
  reservation_id: string;
  share_id: string;
  inventory_id: string;
  quantity: number;
  offered_price: number | null;
  status: string;
  created_at: string;
  counterparty_company: string | null;
  item_title: string;
  currency: string | null;
  list_price: number | null;
  is_middleman: boolean;
  latest_round: number | null;
  latest_counter_price: number | null;
  latest_counter_qty: number | null;
  /** For a 'passed' reservation: the status of the linked upstream pass-through. */
  passthrough_status: string | null;
  /** Item unit (e.g. "barrels", "pcs"). */
  unit: string;
  /** The reservation's request/remark text. */
  message: string | null;
  /** Storage path of the item's first photo (for the card thumbnail), or null. */
  first_photo_path: string | null;
  /** Counterparty's contact email (for the card's email action), or null. */
  counterparty_email: string | null;
  /** Public thumbnail URL derived from first_photo_path (set by the list getters). */
  thumbUrl?: string | null;
}

export type OutgoingReservation = Omit<IncomingReservation, 'is_middleman' | 'passthrough_status'>;

export interface NegotiationRound {
  round_number: number;
  proposed_by: string;
  proposer_company: string | null;
  is_me: boolean;
  counter_price: number | null;
  counter_quantity: number | null;
  message: string | null;
  created_at: string;
}

/** Full negotiation history (oldest → newest) for a reservation the caller is party to. */
export async function getNegotiationRounds(reservationId: string): Promise<NegotiationRound[]> {
  const { data, error } = await supabase.rpc('get_negotiation_rounds', { p_reservation_id: reservationId });
  if (error) throw error;
  return (data ?? []) as NegotiationRound[];
}

/** Public thumbnail URL for a reservation card from the item's first photo path. */
function withThumb<T extends { first_photo_path: string | null }>(row: T): T & { thumbUrl: string | null } {
  return { ...row, thumbUrl: row.first_photo_path ? toFullUrl(row.first_photo_path) : null };
}

/** Incoming: reservations the current vendor must respond to (pending/negotiating). */
export async function getIncomingReservations(): Promise<IncomingReservation[]> {
  const { data, error } = await supabase.rpc('get_reservations_incoming');
  if (error) throw error;
  return ((data ?? []) as IncomingReservation[]).map(withThumb);
}

/** My Reservations: reservations the current vendor requested (any status). */
export async function getMyReservations(): Promise<OutgoingReservation[]> {
  const { data, error } = await supabase.rpc('get_reservations_outgoing');
  if (error) throw error;
  return ((data ?? []) as OutgoingReservation[]).map(withThumb);
}

/** Accept a pending/negotiating reservation: confirm + decrement + notify requester. */
export async function acceptReservation(reservationId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_reservation', { p_reservation_id: reservationId });
  if (error) throw error;
  await notify(reservationId, 'accepted');
}

/** Reject a reservation: no quantity change + notify requester. */
export async function rejectReservation(reservationId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_reservation', { p_reservation_id: reservationId });
  if (error) throw error;
  await notify(reservationId, 'rejected');
}

/** Submit a counter-offer. The DB caps each vendor at 3 rounds — surface its error. */
export async function submitNegotiationRound(
  reservationId: string,
  counterPrice: number,
  counterQuantity: number,
  message: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('submit_negotiation_round', {
    p_reservation_id: reservationId,
    p_counter_price: counterPrice,
    p_counter_quantity: counterQuantity,
    p_message: message,
  });
  if (error) throw error;
  await notify(reservationId, 'countered');
}

/** Middleman passes an incoming reservation one hop upstream to their supplier. */
export async function passToSupplier(reservationId: string): Promise<void> {
  const { error } = await supabase.rpc('pass_to_supplier', { p_reservation_id: reservationId });
  if (error) throw error;
}

/** Requester cancels their own still-pending reservation (RLS allows the requester). */
export async function cancelReservation(reservationId: string): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('reservation_id', reservationId);
  if (error) throw error;
}

/** Fire the reservation-update email (best-effort — don't fail the action). */
async function notify(reservationId: string, status: 'accepted' | 'rejected' | 'countered'): Promise<void> {
  try {
    await supabase.functions.invoke('send-email', {
      body: { type: 'reservation_update', reservationId, status },
    });
  } catch {
    // Notification failures must not roll back the status change.
  }
}
