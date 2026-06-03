
-- ============ STORAGE: prescriptions (read stays public) ============
DROP POLICY IF EXISTS "authenticated_prescription_insert" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_prescription_update" ON storage.objects;
DROP POLICY IF EXISTS "prescriptions_write" ON storage.objects;
DROP POLICY IF EXISTS "prescriptions_update" ON storage.objects;

CREATE POLICY "prescriptions_clinic_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
);

CREATE POLICY "prescriptions_clinic_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
);

CREATE POLICY "prescriptions_clinic_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
);

-- ============ STORAGE: private clinic-scoped buckets ============
DROP POLICY IF EXISTS "private_buckets_all" ON storage.objects;

-- patient-documents: path = clinic_id/patient_id/visit_id/file
CREATE POLICY "patient_documents_clinic_access" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'patient-documents'
  AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
);

-- audio-recordings: path = clinic_id/visit_id/file
CREATE POLICY "audio_recordings_clinic_access" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'audio-recordings'
  AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'audio-recordings'
  AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
);

-- signatures: path = doctor_id/signature.ext — restrict to doctors of caller's clinic
CREATE POLICY "signatures_clinic_doctor_access" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'signatures'
  AND EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND d.clinic_id = public.get_user_clinic_id(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'signatures'
  AND EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id::text = (storage.foldername(name))[1]
      AND d.clinic_id = public.get_user_clinic_id(auth.uid())
  )
);

-- lab-results: path = clinic_id/lab_order_id/file — clinic users by path,
-- lab users via their lab_orders assignment.
CREATE POLICY "lab_results_clinic_access" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'lab-results'
  AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'lab-results'
  AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text
);

CREATE POLICY "lab_results_lab_user_access" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'lab-results'
  AND EXISTS (
    SELECT 1
    FROM public.lab_orders lo
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE lo.id::text = (storage.foldername(name))[2]
      AND lo.lab_id = p.lab_id
      AND p.lab_id IS NOT NULL
  )
)
WITH CHECK (
  bucket_id = 'lab-results'
  AND EXISTS (
    SELECT 1
    FROM public.lab_orders lo
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE lo.id::text = (storage.foldername(name))[2]
      AND lo.lab_id = p.lab_id
      AND p.lab_id IS NOT NULL
  )
);

-- ============ DATABASE: profiles — close clinic-hijack vector ============
-- Profile rows are created exclusively by the handle_new_user trigger
-- (SECURITY DEFINER) using validated invite metadata. Clients should never
-- be able to insert their own profile with an arbitrary clinic_id.
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

-- ============ DATABASE: labs — remove anon PII leak ============
-- Redundant policy exposed email/phone to anon. Existing
-- labs_public_directory still allows anon to read external verified labs;
-- we further restrict that to non-PII via dropping the duplicate.
DROP POLICY IF EXISTS "portal_labs_read" ON public.labs;
