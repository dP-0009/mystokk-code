-- ============================================================
-- 001_vendors_inventory.sql
-- MyStokk — Vendors, Auth-linked profile, OTP, Inventory
-- Source: MyStokk_Claude_Code_Spec.docx §2.1 (+ §2.5 triggers, §3.1 auth trigger)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_bytes() for shares.token (002)

-- ------------------------------------------------------------
-- VENDORS — extends Supabase auth.users (id IS auth.users.id)
-- email_verified is handled by Supabase Auth natively — not duplicated here.
-- ------------------------------------------------------------
CREATE TABLE vendors (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT UNIQUE NOT NULL,
  company_name        TEXT,
  contact_person      TEXT,
  industry            TEXT,
  categories          TEXT[] DEFAULT '{}',
  country_code        TEXT,
  mobile_number       TEXT,
  tel_country_code    TEXT,
  tel_number          TEXT,
  address             TEXT,
  city                TEXT,
  country             TEXT,
  logo_url            TEXT,
  description         TEXT,
  role                TEXT DEFAULT 'vendor' CHECK (role IN ('vendor','admin','team_member')),
  status              TEXT DEFAULT 'active' CHECK (status IN ('active','suspended')),
  onboarded           BOOLEAN DEFAULT false,
  profile_complete    BOOLEAN DEFAULT false,
  auth_provider       TEXT DEFAULT 'password' CHECK (auth_provider IN ('password','google')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vendors_email ON vendors(LOWER(email));

-- profile_complete auto-calculation (§2.5)
CREATE OR REPLACE FUNCTION calculate_profile_complete(v vendors) RETURNS BOOLEAN AS $$
BEGIN
  RETURN v.company_name IS NOT NULL AND v.company_name != '' AND
         v.contact_person IS NOT NULL AND v.contact_person != '' AND
         v.industry IS NOT NULL AND
         v.country IS NOT NULL AND v.city IS NOT NULL AND
         v.mobile_number IS NOT NULL AND v.mobile_number != '';
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_profile_complete() RETURNS TRIGGER AS $$
BEGIN NEW.profile_complete := calculate_profile_complete(NEW); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendors_profile_complete BEFORE INSERT OR UPDATE ON vendors
FOR EACH ROW EXECUTE FUNCTION update_profile_complete();

-- Auto-create a vendors row when a new auth user signs up (§3.1).
-- Required for both password and Google sign-up paths to work.
CREATE OR REPLACE FUNCTION handle_new_auth_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO vendors (id, email) VALUES (NEW.id, LOWER(NEW.email));
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ------------------------------------------------------------
-- OTP CODES — custom signup/reset verification (10-min expiry)
-- ------------------------------------------------------------
CREATE TABLE otp_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT NOT NULL,
  code        TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('signup','reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_otp_email ON otp_codes(LOWER(email), purpose, used);

-- ------------------------------------------------------------
-- INVENTORY
-- ------------------------------------------------------------
CREATE TABLE inventory (
  inventory_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id           UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  product_code        TEXT,
  category            TEXT,
  description         TEXT,
  quantity            NUMERIC NOT NULL DEFAULT 0,
  quantity_available  NUMERIC NOT NULL DEFAULT 0,
  unit                TEXT NOT NULL DEFAULT 'pcs',
  currency            TEXT NOT NULL DEFAULT 'AED',
  price               NUMERIC,
  origin              TEXT,
  stock_location      TEXT,
  status              TEXT DEFAULT 'active' CHECK (status IN
                       ('active','partially_allocated','partially_reserved',
                        'sold_out','archived')),
  shared_count        INTEGER DEFAULT 0,  -- direct shares only; forwards never increment
  specs               JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inventory_vendor ON inventory(vendor_id, status);
CREATE INDEX idx_inventory_fts ON inventory USING GIN(
  to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(product_code,'') ||
  ' ' || coalesce(category,'')));

-- inventory.status auto-update based on quantity_available (§2.5)
CREATE OR REPLACE FUNCTION update_inventory_status() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity_available <= 0 THEN
    NEW.status := 'sold_out';
  ELSIF NEW.quantity_available < NEW.quantity AND NEW.status != 'archived' THEN
    NEW.status := 'partially_reserved';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_status_update BEFORE UPDATE ON inventory
FOR EACH ROW WHEN (NEW.quantity_available IS DISTINCT FROM OLD.quantity_available)
EXECUTE FUNCTION update_inventory_status();

CREATE TABLE inventory_photos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id    UUID NOT NULL REFERENCES inventory(inventory_id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  original_name   TEXT,
  sort_order      INTEGER DEFAULT 0,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory_files (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id    UUID NOT NULL REFERENCES inventory(inventory_id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  original_name   TEXT,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);
