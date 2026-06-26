-- ============================================================
-- 002_network_shares.sql
-- MyStokk — Shares (the privacy chain), Connections, Manual Vendors
-- Source: MyStokk_Claude_Code_Spec.docx §2.2
--
-- ⚠️  This is the most important migration in the entire schema.
--     Read every comment carefully before changing anything.
-- ============================================================

-- ------------------------------------------------------------
-- SHARES — every hop of every share chain
-- ------------------------------------------------------------
CREATE TABLE shares (
  share_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token               TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  inventory_id        UUID NOT NULL REFERENCES inventory(inventory_id) ON DELETE CASCADE,
  original_owner_id   UUID NOT NULL REFERENCES vendors(id),
  -- ^ The TRUE owner. Internal use only.
  --   NEVER select this column in any query result returned to a
  --   recipient client when chain_depth > 0. Enforced via the
  --   secure view/RPC in 004, not just application code.
  source_vendor_id    UUID NOT NULL REFERENCES vendors(id),
  -- ^ Who shared THIS specific hop. This is what recipients see as 'Shared by'.
  recipient_id        UUID REFERENCES vendors(id),
  -- ^ NULL means this is a public forward link (no specific recipient yet)
  parent_share_id     UUID REFERENCES shares(share_id),
  -- ^ Set when this row is a forward of another share
  chain_depth         INTEGER NOT NULL DEFAULT 0,
  -- ^ 0 = original owner's direct share. +1 each forward hop.
  status              TEXT DEFAULT 'active' CHECK (status IN ('active','revoked')),
  forward_price       NUMERIC,
  forward_currency    TEXT,
  forward_remark      TEXT,
  -- ^ The forwarder's own override. If set, shown to the recipient
  --   INSTEAD of the original inventory.price.
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_shares_recipient ON shares(recipient_id, status);
CREATE INDEX idx_shares_source ON shares(source_vendor_id);
CREATE INDEX idx_shares_inventory ON shares(inventory_id);
CREATE INDEX idx_shares_parent ON shares(parent_share_id);
CREATE INDEX idx_shares_token ON shares(token);

-- ------------------------------------------------------------
-- CONNECTIONS (Network)
-- ------------------------------------------------------------
CREATE TABLE connections (
  connection_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id            UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  connected_vendor_id  UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  status               TEXT DEFAULT 'pending' CHECK (status IN ('pending','connected','rejected')),
  group_name           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, connected_vendor_id)
);
CREATE INDEX idx_connections_vendor ON connections(vendor_id, status);

-- ------------------------------------------------------------
-- MANUAL VENDORS — non-signup contacts
-- ------------------------------------------------------------
CREATE TABLE manual_vendors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_vendor_id     UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  company_name        TEXT NOT NULL,
  contact_person      TEXT,
  email               TEXT,
  mobile_number       TEXT,
  industry            TEXT,
  country             TEXT,
  city                TEXT,
  group_name          TEXT,
  is_registered       BOOLEAN DEFAULT false,
  linked_vendor_id    UUID REFERENCES vendors(id),
  -- ^ Set automatically when the contact's email later signs up
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_manual_vendors_owner ON manual_vendors(owner_vendor_id);
CREATE INDEX idx_manual_vendors_email ON manual_vendors(LOWER(email));

-- Trigger: when a vendor signs up, auto-link any matching manual_vendors row
CREATE OR REPLACE FUNCTION link_manual_vendor_on_signup() RETURNS TRIGGER AS $$
BEGIN
  UPDATE manual_vendors
  SET is_registered = true, linked_vendor_id = NEW.id, updated_at = NOW()
  WHERE LOWER(email) = LOWER(NEW.email) AND linked_vendor_id IS NULL;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER vendors_link_manual AFTER INSERT ON vendors
FOR EACH ROW EXECUTE FUNCTION link_manual_vendor_on_signup();
