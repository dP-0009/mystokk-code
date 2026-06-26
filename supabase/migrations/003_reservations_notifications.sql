-- ============================================================
-- 003_reservations_notifications.sql
-- MyStokk — Reservations, Negotiation rounds, Notifications, Chat
-- Source: MyStokk_Claude_Code_Spec.docx §2.3
-- ============================================================

-- ------------------------------------------------------------
-- RESERVATIONS
-- ------------------------------------------------------------
CREATE TABLE reservations (
  reservation_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id           UUID NOT NULL REFERENCES inventory(inventory_id),
  share_id               UUID NOT NULL REFERENCES shares(share_id),
  -- ^ Which share this reservation was made against
  requester_id           UUID NOT NULL REFERENCES vendors(id),   -- buyer
  responder_id           UUID NOT NULL REFERENCES vendors(id),   -- seller
  -- ^ The CURRENT chain seller — i.e. shares.source_vendor_id of
  --   share_id, NOT necessarily the original inventory owner.
  quantity               NUMERIC NOT NULL,
  offered_price          NUMERIC,
  message                TEXT,
  status                 TEXT DEFAULT 'pending' CHECK (status IN
                         ('pending','negotiating','confirmed','rejected',
                          'cancelled','passed')),
  parent_reservation_id  UUID REFERENCES reservations(reservation_id),
  -- ^ Set for pass-to-supplier chains (self-referencing)
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reservations_requester ON reservations(requester_id, status);
CREATE INDEX idx_reservations_responder ON reservations(responder_id, status);
CREATE INDEX idx_reservations_inventory ON reservations(inventory_id);

-- ------------------------------------------------------------
-- NEGOTIATION ROUNDS — separate table so the 3-round cap per side
-- can be queried and enforced server-side, not buried in JSON.
-- NOTE: the service layer must ALSO check this cap before inserting
-- (per spec) — the DB trigger below is the last line of defence.
-- ------------------------------------------------------------
CREATE TABLE negotiation_rounds (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id    UUID NOT NULL REFERENCES reservations(reservation_id) ON DELETE CASCADE,
  round_number      INTEGER NOT NULL,   -- 1, 2, or 3
  proposed_by       UUID NOT NULL REFERENCES vendors(id),
  counter_price     NUMERIC,
  counter_quantity  NUMERIC,
  message           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_negotiation_reservation ON negotiation_rounds(reservation_id);

-- Enforce max 3 rounds PER PROPOSING VENDOR at the database level
CREATE OR REPLACE FUNCTION check_negotiation_cap() RETURNS TRIGGER AS $$
DECLARE round_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO round_count FROM negotiation_rounds
  WHERE reservation_id = NEW.reservation_id AND proposed_by = NEW.proposed_by;
  IF round_count >= 3 THEN
    RAISE EXCEPTION 'Negotiation round limit (3) reached for this vendor on this reservation';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER negotiation_rounds_cap BEFORE INSERT ON negotiation_rounds
FOR EACH ROW EXECUTE FUNCTION check_negotiation_cap();

-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------
CREATE TABLE notifications (
  notification_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id         UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  title             TEXT NOT NULL,
  body              TEXT,
  related_id        UUID,   -- points to inventory/share/reservation (nullable)
  read              BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_vendor ON notifications(vendor_id, read, created_at DESC);

-- ------------------------------------------------------------
-- CONVERSATIONS & MESSAGES — 1:1 chat between connected vendors
-- ------------------------------------------------------------
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_a_id   UUID NOT NULL REFERENCES vendors(id),
  vendor_b_id   UUID NOT NULL REFERENCES vendors(id),
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_a_id, vendor_b_id)
);

CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES vendors(id),
  body              TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
