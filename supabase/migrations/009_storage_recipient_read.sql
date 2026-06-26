-- ============================================================
-- 009_storage_recipient_read.sql
-- Lets a share RECIPIENT read (and thus generate a signed URL for) the
-- private photos/docs of an inventory they hold an ACTIVE share for.
-- Buckets stay private — access is signed-URL only, gated by the shares table.
--
-- Relies on the upload path convention <vendor_id>/<inventory_id>/<file>,
-- so (storage.foldername(name))[2] is the inventory_id.
-- ============================================================

CREATE POLICY "inv_photos_recipient_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inventory-photos'
    AND EXISTS (
      SELECT 1 FROM public.shares s
      WHERE s.recipient_id = auth.uid()
        AND s.status = 'active'
        AND s.inventory_id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "inv_docs_recipient_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inventory-documents'
    AND EXISTS (
      SELECT 1 FROM public.shares s
      WHERE s.recipient_id = auth.uid()
        AND s.status = 'active'
        AND s.inventory_id::text = (storage.foldername(name))[2]
    )
  );
