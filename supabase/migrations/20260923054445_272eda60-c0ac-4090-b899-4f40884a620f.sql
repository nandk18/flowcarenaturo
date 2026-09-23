ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS treatment_overbooking_allowed boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.super_admin_set_clinic_treatment(p_clinic_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can change this setting';
  END IF;

  UPDATE public.clinics SET treatment_enabled = p_enabled WHERE id = p_clinic_id;

  INSERT INTO public.audit_logs (clinic_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (p_clinic_id, auth.uid(),
          CASE WHEN p_enabled THEN 'treatment_enabled' ELSE 'treatment_disabled' END,
          'clinic', p_clinic_id, jsonb_build_object('enabled', p_enabled));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.super_admin_set_clinic_treatment(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_set_clinic_treatment(uuid, boolean) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.super_admin_clinic_summary();
CREATE FUNCTION public.super_admin_clinic_summary()
RETURNS TABLE(clinic_id uuid, clinic_name text, is_active boolean, subscription_status text, trial_ends_at timestamp with time zone, disabled_at timestamp with time zone, disabled_reason text, created_at timestamp with time zone, onboarding_complete boolean, treatment_enabled boolean, users_count bigint, patients_count bigint, visits_7d bigint, appts_7d bigint, revenue_30d numeric, last_activity timestamp with time zone)
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
    c.subscription_status,
    c.trial_ends_at,
    c.disabled_at,
    c.disabled_reason,
    c.created_at,
    c.onboarding_complete,
    COALESCE(c.treatment_enabled, false),
    (SELECT COUNT(*) FROM public.profiles p WHERE p.clinic_id = c.id),
    (SELECT COUNT(*) FROM public.patients pa WHERE pa.clinic_id = c.id),
    (SELECT COUNT(*) FROM public.visits v WHERE v.clinic_id = c.id AND v.created_at >= now() - interval '7 days'),
    (SELECT COUNT(*) FROM public.appointments a WHERE a.clinic_id = c.id AND a.created_at >= now() - interval '7 days'),
    COALESCE((SELECT SUM(pay.amount) FROM public.payments pay WHERE pay.clinic_id = c.id AND pay.created_at >= now() - interval '30 days'), 0),
    (SELECT MAX(al.created_at) FROM public.audit_logs al WHERE al.clinic_id = c.id)
  FROM public.clinics c
  ORDER BY c.name;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.super_admin_clinic_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_clinic_summary() TO authenticated, service_role;