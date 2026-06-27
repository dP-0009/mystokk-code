-- Add CSV to the inventory-documents bucket's allowed MIME types.
-- Uploading a .csv document was failing with "mime type text/csv is not supported"
-- because the bucket whitelist omitted it. Browsers report CSV as either
-- text/csv or (less commonly) application/csv, so allow both.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv'
]
where id = 'inventory-documents';
