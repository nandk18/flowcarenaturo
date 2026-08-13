DROP FUNCTION IF EXISTS public.super_admin_clinic_summary();

CREATE OR REPLACE FUNCTION public.super_admin_clinic_summary()
 RETURNS TABLE(clinic_id uuid, clinic_name text, is_active boolean, whatsapp_enabled boolean, disabled_at timestamp with time zone, disabled_reason text, created_at timestamp with time zone, onboarding_complete boolean, users_count bigint, patients_count bigint, visits_7d bigint, appts_7d bigint, revenue_30d numeric, last_activity timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super admin required';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.is_active,
    c.whatsapp_enabled,
    c.disabled_at,
    c.disabled_reason,
    c.created_at,
    c.onboarding_complete,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.clinic_id = c.id),
    (SELECT COUNT(*) FROM public.patients pa WHERE pa.clinic_id = c.id),
    (SELECT COUNT(*) FROM public.visits v WHERE v.clinic_id = c.id AND v.created_at >= now() - interval '7 days'),
    (SELECT COUNT(*) FROM public.appointments a WHERE a.clinic_id = c.id AND a.created_at >= now() - interval '7 days'),
    COALESCE((SELECT SUM(pay.amount) FROM public.payments pay WHERE pay.clinic_id = c.id AND pay.created_at >= now() - interval '30 days'), 0),
    (SELECT MAX(al.created_at) FROM public.audit_logs al WHERE al.clinic_id = c.id)
  FROM public.clinics c
  ORDER BY c.name;
END $function$;