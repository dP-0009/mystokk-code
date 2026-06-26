-- ============================================================
-- 032_public_inventory_photos.sql
-- Make the inventory-photos bucket PUBLIC-READ so share previews (the WhatsApp /
-- OG unfurl card) and the login-free public share landing page can show the
-- product photo without auth or a service-key signing round-trip.
--
-- Rationale: product photos are stock images meant to be seen by anyone the
-- share link reaches (a buyer won't reserve stock they can't see). Object paths
-- contain unguessable UUIDs (<vendorId>/<inventoryId>/<file>), so in practice
-- only recipients of the link can find them.
--
-- Scope: PHOTOS ONLY. The inventory-documents bucket stays private (spec sheets
-- can be sensitive). Owner-write policies are unchanged — uploads remain gated
-- to the authenticated owner; only READ becomes public.
-- ============================================================

UPDATE storage.buckets SET public = true WHERE id = 'inventory-photos';
