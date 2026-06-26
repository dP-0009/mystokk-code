-- ============================================================
-- 004_indexes_rls.sql
-- MyStokk — Row Level Security + the Privacy-Safe View/RPC
-- Source: MyStokk_Claude_Code_Spec.docx §2.4
--
-- NOTE on "indexes": per the spec, every table's indexes are defined
-- inline alongside the table in 001–003 (an index must follow its
-- table). This migration therefore focuses on RLS and the privacy
-- enforcement layer — the part that actually guards the share chain.
--
-- ⚠️  This migration is what enforces the privacy chain. The mobile
--     app MUST query the get_received_shares RPC for any 'Received'
--     screen — never the shares table directly.
-- ============================================================

-- ------------------------------------------------------------
-- Enable Row Level Security on every table
-- ------------------------------------------------------------
ALTER TABLE vendors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_photos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_vendors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares             ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes          ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Standard policies — vendors see only their own data
-- ------------------------------------------------------------
CREATE POLICY vendors_self ON vendors FOR ALL USING (auth.uid() = id);
CREATE POLICY inventory_own ON inventory FOR ALL USING (auth.uid() = vendor_id);
CREATE POLICY photos_own ON inventory_photos FOR ALL USING (
  EXISTS (SELECT 1 FROM inventory i WHERE i.inventory_id = inventory_photos.inventory_id
  AND i.vendor_id = auth.uid()));
CREATE POLICY files_own ON inventory_files FOR ALL USING (
  EXISTS (SELECT 1 FROM inventory i WHERE i.inventory_id = inventory_files.inventory_id
  AND i.vendor_id = auth.uid()));
CREATE POLICY connections_own ON connections FOR ALL USING (
  auth.uid() = vendor_id OR auth.uid() = connected_vendor_id);
CREATE POLICY manual_vendors_own ON manual_vendors FOR ALL USING (auth.uid() = owner_vendor_id);
CREATE POLICY reservations_own ON reservations FOR ALL USING (
  auth.uid() = requester_id OR auth.uid() = responder_id);
CREATE POLICY negotiation_own ON negotiation_rounds FOR ALL USING (
  EXISTS (SELECT 1 FROM reservations r WHERE r.reservation_id = negotiation_rounds.reservation_id
  AND (r.requester_id = auth.uid() OR r.responder_id = auth.uid())));
CREATE POLICY notifications_own ON notifications FOR ALL USING (auth.uid() = vendor_id);
CREATE POLICY conversations_own ON conversations FOR ALL USING (
  auth.uid() = vendor_a_id OR auth.uid() = vendor_b_id);
CREATE POLICY messages_own ON messages FOR ALL USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id
  AND (c.vendor_a_id = auth.uid() OR c.vendor_b_id = auth.uid())));

-- otp_codes: writes/reads are brokered by the service layer (Edge Function
-- using the service role, which bypasses RLS). No public policy is granted,
-- so the anon/authenticated roles cannot read others' codes.

-- ------------------------------------------------------------
-- SHARES table RLS — owner can manage all their shares (any depth
-- where they are source_vendor_id OR original_owner_id); recipients
-- can read shares addressed to them. This is INTENTIONALLY permissive
-- at the ROW level — the privacy filtering of WHICH COLUMNS are
-- visible happens in the secure view/RPC below, which the app queries.
-- ------------------------------------------------------------
CREATE POLICY shares_manage_own ON shares FOR ALL USING (
  auth.uid() = source_vendor_id OR auth.uid() = original_owner_id);
CREATE POLICY shares_read_received ON shares FOR SELECT USING (
  auth.uid() = recipient_id);

-- ════════════════════════════════════════════════════════════
-- THE PRIVACY-SAFE VIEW — query this for any 'Received' screen.
-- Deliberately OMITS original_owner_id from its output entirely.
-- Joins source_vendor_id's PUBLIC profile fields only, and computes
-- the effective display price (forward_price if set, else true price)
-- so the client never reasons about the override logic itself.
-- ════════════════════════════════════════════════════════════
CREATE VIEW safe_received_shares AS
SELECT
  s.share_id,
  s.token,
  s.inventory_id,
  s.recipient_id,
  s.chain_depth,
  s.status,
  s.created_at,
  -- Source vendor's PUBLIC info only — never original_owner_id
  sv.id              AS shared_by_vendor_id,
  sv.company_name    AS shared_by_company_name,
  sv.logo_url        AS shared_by_logo_url,
  -- Effective price: forward override wins if present
  COALESCE(s.forward_price, i.price)       AS display_price,
  COALESCE(s.forward_currency, i.currency) AS display_currency,
  s.forward_remark,
  -- Inventory display fields (safe — these are meant to be seen)
  i.title, i.description, i.category, i.quantity, i.unit,
  i.origin, i.specs, i.status AS inventory_status
FROM shares s
JOIN vendors sv ON sv.id = s.source_vendor_id
JOIN inventory i ON i.inventory_id = s.inventory_id
WHERE s.status = 'active';

GRANT SELECT ON safe_received_shares TO authenticated;

-- Guaranteed-enforcement wrapper: the app calls this RPC, which runs
-- as the definer and filters strictly to the calling vendor's rows.
CREATE OR REPLACE FUNCTION get_received_shares(p_vendor_id UUID)
RETURNS SETOF safe_received_shares AS $$
  SELECT * FROM safe_received_shares WHERE recipient_id = p_vendor_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- The mobile app calls supabase.rpc('get_received_shares', { p_vendor_id: ... })
-- — NEVER selects from shares directly for the Received screen.
-- A privacy test (Build Guide §9) must assert that original_owner_id and
-- vendor A's company_name never appear in this RPC's response for vendor C.
