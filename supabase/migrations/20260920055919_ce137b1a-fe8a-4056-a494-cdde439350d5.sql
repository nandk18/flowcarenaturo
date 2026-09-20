REVOKE EXECUTE ON FUNCTION public.patient_list_metrics(uuid, text, text, text, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.patient_list_metrics(uuid, text, text, text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patient_list_metrics(uuid, text, text, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.patient_list_metrics(uuid, text, text, text, timestamptz, timestamptz) TO service_role;