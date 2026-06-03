-- Public read access for prescription files
DROP POLICY IF EXISTS "public_prescription_storage" ON storage.objects;
CREATE POLICY "public_prescription_storage"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'prescriptions');

-- Authenticated users can insert prescription files
DROP POLICY IF EXISTS "authenticated_prescription_insert" ON storage.objects;
CREATE POLICY "authenticated_prescription_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'prescriptions');

-- Authenticated users can update prescription files
DROP POLICY IF EXISTS "authenticated_prescription_update" ON storage.objects;
CREATE POLICY "authenticated_prescription_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'prescriptions');