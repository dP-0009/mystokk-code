-- ============================================================
-- 007_storage_buckets.sql  (spec §2.6)
--   inventory-photos      private, signed URLs only — product photos
--   inventory-documents   private, signed URLs only — spec sheets/certs
--   company-logos         public read — vendor logos on share cards
--
-- PATH CONVENTION (enforced by the policies below):
--   every object MUST be stored under  <vendor_id>/...
--   i.e. the first folder segment == the uploader's auth.uid().
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('inventory-photos', 'inventory-photos', false, 10485760,   -- 10 MB
     ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('inventory-documents', 'inventory-documents', false, 20971520, -- 20 MB
     ARRAY['application/pdf','image/jpeg','image/png',
           'application/msword',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'application/vnd.ms-excel',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('company-logos', 'company-logos', true, 2097152,            -- 2 MB
     ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- ----- PRIVATE: inventory-photos — owner-only (recipients view via signed URLs)
CREATE POLICY "inv_photos_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'inventory-photos'
         AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
  WITH CHECK (bucket_id = 'inventory-photos'
         AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

-- ----- PRIVATE: inventory-documents — owner-only
CREATE POLICY "inv_docs_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'inventory-documents'
         AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
  WITH CHECK (bucket_id = 'inventory-documents'
         AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

-- ----- PUBLIC: company-logos — anyone reads; owner manages own folder
CREATE POLICY "logos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'company-logos');

CREATE POLICY "logos_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos'
         AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

CREATE POLICY "logos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos'
         AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
  WITH CHECK (bucket_id = 'company-logos'
         AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

CREATE POLICY "logos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos'
         AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
