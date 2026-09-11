CREATE OR REPLACE FUNCTION public.enforce_patient_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_allowed integer;
  current_count integer;
BEGIN
  SELECT COALESCE(max_patients_allowed, 1000000) INTO max_allowed
  FROM public.clinics WHERE id = NEW.clinic_id;

  SELECT COUNT(*) INTO current_count
  FROM public.patients
  WHERE clinic_id = NEW.clinic_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Patient limit reached for this clinic. Upgrade your plan to add more patients. Current limit: %', max_allowed;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_patient_limit ON public.patients;
CREATE TRIGGER check_patient_limit
BEFORE INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.enforce_patient_limit();

GRANT EXECUTE ON FUNCTION public.enforce_patient_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_patient_limit() TO service_role;