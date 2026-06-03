
-- 1. Remove permissive anon policies (replaced by edge function with HMAC token)
DROP POLICY IF EXISTS portal_appointments_read ON public.appointments;
DROP POLICY IF EXISTS portal_appointments_cancel ON public.appointments;
DROP POLICY IF EXISTS portal_notes_read ON public.clinical_notes;
DROP POLICY IF EXISTS portal_clinics_read ON public.clinics;
DROP POLICY IF EXISTS portal_doctors_read ON public.doctors;
DROP POLICY IF EXISTS portal_lab_results_read ON public.lab_results;
DROP POLICY IF EXISTS portal_patient_lookup ON public.patients;
DROP POLICY IF EXISTS portal_visits_read ON public.visits;

-- 2. Tighten clinics_insert: require authenticated
DROP POLICY IF EXISTS clinics_insert ON public.clinics;
CREATE POLICY clinics_insert
ON public.clinics
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. note_templates: add UPDATE/DELETE policies (block system templates)
CREATE POLICY templates_update
ON public.note_templates
FOR UPDATE
TO authenticated
USING (
  is_system = false
  AND clinic_id = public.get_user_clinic_id(auth.uid())
)
WITH CHECK (
  is_system = false
  AND clinic_id = public.get_user_clinic_id(auth.uid())
);

CREATE POLICY templates_delete
ON public.note_templates
FOR DELETE
TO authenticated
USING (
  is_system = false
  AND clinic_id = public.get_user_clinic_id(auth.uid())
);

-- 4. Fix signatures storage policy: was referencing storage.foldername(d.name) instead of storage.foldername(objects.name)
DROP POLICY IF EXISTS signatures_clinic_doctor_access ON storage.objects;
CREATE POLICY signatures_clinic_doctor_access
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'signatures'
  AND EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE (d.id)::text = (storage.foldername(storage.objects.name))[1]
      AND d.clinic_id = public.get_user_clinic_id(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'signatures'
  AND EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE (d.id)::text = (storage.foldername(storage.objects.name))[1]
      AND d.clinic_id = public.get_user_clinic_id(auth.uid())
  )
);
