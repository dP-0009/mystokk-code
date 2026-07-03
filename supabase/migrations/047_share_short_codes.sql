-- ------------------------------------------------------------
-- SHARE SHORT CODES — compact links (mystokk.vercel.app/s/<code>)
-- ------------------------------------------------------------
-- The full share token is 32 hex chars, making emailed links long. Add a short
-- base62 code per share and resolve it back to the token at /s/<code>.

ALTER TABLE shares ADD COLUMN IF NOT EXISTS short_code TEXT;

-- Random base62 string of the requested length.
CREATE OR REPLACE FUNCTION public.gen_short_code(p_len int DEFAULT 7)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  out   text := '';
  i     int;
BEGIN
  FOR i IN 1..p_len LOOP
    out := out || substr(chars, floor(random() * 62)::int + 1, 1);
  END LOOP;
  RETURN out;
END; $$;

-- Assign a unique short_code on insert (grows length if unlucky with collisions).
CREATE OR REPLACE FUNCTION public.shares_assign_short_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_code  text;
  v_len   int := 7;
  v_tries int := 0;
BEGIN
  IF NEW.short_code IS NOT NULL THEN RETURN NEW; END IF;
  LOOP
    v_code := public.gen_short_code(v_len);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM shares WHERE short_code = v_code);
    v_tries := v_tries + 1;
    IF v_tries % 5 = 0 THEN v_len := v_len + 1; END IF;
  END LOOP;
  NEW.short_code := v_code;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS shares_short_code ON shares;
CREATE TRIGGER shares_short_code BEFORE INSERT ON shares
FOR EACH ROW EXECUTE FUNCTION public.shares_assign_short_code();

-- Backfill existing rows.
DO $$
DECLARE
  r       RECORD;
  v_code  text;
  v_len   int;
  v_tries int;
BEGIN
  FOR r IN SELECT share_id FROM shares WHERE short_code IS NULL LOOP
    v_len := 7; v_tries := 0;
    LOOP
      v_code := public.gen_short_code(v_len);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM shares WHERE short_code = v_code);
      v_tries := v_tries + 1;
      IF v_tries % 5 = 0 THEN v_len := v_len + 1; END IF;
    END LOOP;
    UPDATE shares SET short_code = v_code WHERE share_id = r.share_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS shares_short_code_key ON shares(short_code);

-- Anon-safe resolver: short_code -> token (the token is itself a public share id,
-- so this exposes nothing the /share/<token> route doesn't already).
CREATE OR REPLACE FUNCTION public.token_for_short_code(p_code text)
RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT token FROM shares WHERE short_code = p_code AND status = 'active' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.token_for_short_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.token_for_short_code(text) TO anon, authenticated;

-- create_forward_link now returns the SHORT CODE (client builds /s/<code>).
CREATE OR REPLACE FUNCTION public.create_forward_link(
  p_parent_share_id uuid,
  p_forward_price   numeric,
  p_forward_currency text,
  p_forward_remark  text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me     uuid := auth.uid();
  parent shares%ROWTYPE;
  v_code text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO parent FROM shares WHERE share_id = p_parent_share_id AND status = 'active';
  IF parent.share_id IS NULL THEN RAISE EXCEPTION 'Share not found'; END IF;
  IF parent.recipient_id <> me THEN RAISE EXCEPTION 'You can only forward a share you received'; END IF;

  INSERT INTO shares (inventory_id, original_owner_id, source_vendor_id, recipient_id, parent_share_id, chain_depth, forward_price, forward_currency, forward_remark, status)
  VALUES (parent.inventory_id, parent.original_owner_id, me, NULL, parent.share_id, parent.chain_depth + 1, p_forward_price, p_forward_currency, p_forward_remark, 'active')
  RETURNING short_code INTO v_code;
  RETURN v_code;
END;
$$;
REVOKE ALL ON FUNCTION public.create_forward_link(uuid, numeric, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_forward_link(uuid, numeric, text, text) TO authenticated;
