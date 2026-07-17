import { supabase } from './client';

/**
 * Support / contact form — client wrapper around the `send-support-message`
 * Edge Function (which validates, stores the row, and emails support). Shared by
 * the native Contact screen and the web Contact page.
 */

export type SupportTopic = 'Account' | 'Bug' | 'Feedback' | 'Other';
export const SUPPORT_TOPICS: readonly SupportTopic[] = ['Account', 'Bug', 'Feedback', 'Other'];
export const SUPPORT_MIN_MESSAGE = 10;

export interface SupportMessageInput {
  name: string;
  email: string;
  topic: SupportTopic;
  message: string;
}

/** Submit a support message. Throws with a user-facing message on failure. */
export async function sendSupportMessage(input: SupportMessageInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-support-message', { body: input });

  if (error) {
    // functions.invoke surfaces non-2xx as a FunctionsHttpError with the response
    // body on `context`; pull out the server's { error } message when we can.
    let message = 'Could not send your message. Please try again.';
    try {
      const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
      const parsed = (await ctx?.json?.()) as { error?: string } | undefined;
      if (parsed?.error) message = parsed.error;
    } catch {
      /* fall back to the generic message */
    }
    throw new Error(message);
  }

  const payload = data as { ok?: boolean; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
}
