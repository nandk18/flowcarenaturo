ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.super_admin_set_clinic_whatsapp(p_clinic_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can change this setting';
  END IF;

  UPDATE public.clinics SET whatsapp_enabled = p_enabled WHERE id = p_clinic_id;

  INSERT INTO public.audit_logs (clinic_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (p_clinic_id, auth.uid(),
          CASE WHEN p_enabled THEN 'whatsapp_enabled' ELSE 'whatsapp_disabled' END,
          'clinic', p_clinic_id, jsonb_build_object('enabled', p_enabled));
END;
$$;