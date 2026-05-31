-- Patient Portal: anon read access for phone+DOB verified portal
-- WARNING: USING (true) means anonymous users can read ALL records in these tables
-- via the anon key. Verification is enforced client-side only.

CREATE POLICY "portal_patient_lookup" ON public.patients
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.patients TO anon;

CREATE POLICY "portal_visits_read" ON public.visits
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.visits TO anon;

CREATE POLICY "portal_notes_read" ON public.clinical_notes
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.clinical_notes TO anon;

CREATE POLICY "portal_lab_results_read" ON public.lab_results
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.lab_results TO anon;

CREATE POLICY "portal_appointments_read" ON public.appointments
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.appointments TO anon;

CREATE POLICY "portal_labs_read" ON public.labs
  FOR SELECT TO anon USING (true);
-- labs already grants anon select

CREATE POLICY "portal_doctors_read" ON public.doctors
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.doctors TO anon;

CREATE POLICY "portal_clinics_read" ON public.clinics
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.clinics TO anon;

CREATE POLICY "portal_appointments_cancel" ON public.appointments
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

GRANT UPDATE ON public.appointments TO anon;
