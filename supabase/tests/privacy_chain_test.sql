-- ============================================================
-- privacy_chain_test.sql  —  Build Guide §7.2 / Spec §7.2
--
-- Proves the privacy chain for A -> B -> C:
--   A (Alpha Owner) shares an item (price 100) to B.
--   B (Bravo Middle) forwards to C with a forward_price of 130.
--   Querying C's view (the client-reachable RPCs) NEVER returns A's vendor_id,
--   A's company_name, the original price, or any original_owner field.
--   And the forward does NOT increment the owner's inventory.shared_count.
--
-- Self-contained + non-destructive: wrapped in BEGIN/ROLLBACK and self-asserting
-- (raises on any failure). Run with:  psql "$DATABASE_URL" -f privacy_chain_test.sql
-- ============================================================
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, email_confirmed_at)
VALUES
 ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chain_a@test.example','x',now(),now(),'{}','{}','',now()),
 ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chain_b@test.example','x',now(),now(),'{}','{}','',now()),
 ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chain_c@test.example','x',now(),now(),'{}','{}','',now());

UPDATE vendors SET company_name='Alpha Owner LLC' WHERE id='00000000-0000-0000-0000-0000000000a1';
UPDATE vendors SET company_name='Bravo Middle Co' WHERE id='00000000-0000-0000-0000-0000000000b1';
UPDATE vendors SET company_name='Charlie Buyer'   WHERE id='00000000-0000-0000-0000-0000000000c1';

INSERT INTO inventory (vendor_id,title,quantity,quantity_available,unit,currency,price,status,shared_count,specs)
VALUES ('00000000-0000-0000-0000-0000000000a1','ZZ Chain Item',1000,1000,'pcs','AED',100,'active',0,'{}');

-- A -> B (direct)
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
SELECT create_direct_shares((SELECT inventory_id FROM inventory WHERE title='ZZ Chain Item'),
                            ARRAY['00000000-0000-0000-0000-0000000000b1']::uuid[]);

-- B -> C (forward, override price 130)
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}',true);
SELECT create_forward_shares(
  (SELECT share_id FROM shares
     WHERE recipient_id='00000000-0000-0000-0000-0000000000b1'
       AND inventory_id=(SELECT inventory_id FROM inventory WHERE title='ZZ Chain Item')),
  ARRAY['00000000-0000-0000-0000-0000000000c1']::uuid[], 130, 'AED', 'B markup');

-- Assertions from C's perspective
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}',true);

DO $$
DECLARE
  v_blob   text;
  v_seller text;
  v_price  numeric;
  v_count  int;
BEGIN
  SELECT (to_jsonb(cs) )::text, cs.shared_by_company_name, cs.display_price
    INTO v_blob, v_seller, v_price
  FROM get_received_shares('00000000-0000-0000-0000-0000000000c1'::uuid) cs
  WHERE cs.title = 'ZZ Chain Item';

  -- augment the blob with the detail + public RPC outputs
  v_blob := v_blob
    || (SELECT to_jsonb(d)::text FROM get_received_share(
          (SELECT share_id FROM get_received_shares('00000000-0000-0000-0000-0000000000c1'::uuid) WHERE title='ZZ Chain Item')) d)
    || (SELECT to_jsonb(p)::text FROM get_public_share(
          (SELECT token FROM get_received_shares('00000000-0000-0000-0000-0000000000c1'::uuid) WHERE title='ZZ Chain Item')) p);

  IF v_seller <> 'Bravo Middle Co' THEN RAISE EXCEPTION 'FAIL: seller should be B, got %', v_seller; END IF;
  IF v_price <> 130 THEN RAISE EXCEPTION 'FAIL: price should be 130 (forward), got %', v_price; END IF;
  IF v_blob LIKE '%0000000000a1%' THEN RAISE EXCEPTION 'LEAK: A vendor_id present in C-reachable data'; END IF;
  IF v_blob LIKE '%Alpha Owner%'  THEN RAISE EXCEPTION 'LEAK: A company_name present in C-reachable data'; END IF;
  IF v_blob LIKE '%original_owner%' THEN RAISE EXCEPTION 'LEAK: original_owner field present'; END IF;

  SELECT shared_count INTO v_count FROM inventory WHERE title='ZZ Chain Item';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: forward must not change shared_count, got %', v_count; END IF;

  RAISE NOTICE 'PASS: privacy chain holds (seller=B, price=130, no A id/company/owner leak, shared_count=1)';
END $$;

ROLLBACK;
