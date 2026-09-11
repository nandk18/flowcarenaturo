REVOKE ALL ON FUNCTION public.enforce_patient_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_patient_limit() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_patient_limit() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_patient_limit() TO service_role;