-- ============================================================================
-- EDITED-FROM PROVENANCE (048)
--
-- When a vendor edits an item they RECEIVED and saves it as their own, we record
-- where the copy came from so their inventory detail page can show a small,
-- non-highlighted "Edited from … shared by <company>" note with a link back.
--
-- PRIVACY-CRITICAL: these columns live on `inventory`, whose RLS is owner-only
-- (policy inventory_own: auth.uid() = vendor_id). They are NEVER selected by any
-- share / received / public RPC (all of which list explicit columns), so this
-- provenance is never forwarded to recipients of the edited item.
-- ============================================================================

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS edited_from_share_id uuid REFERENCES shares(share_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_from_company  text,
  ADD COLUMN IF NOT EXISTS edited_from_title    text;
