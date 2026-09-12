CREATE OR REPLACE FUNCTION public.super_admin_activate_clinic(p_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super admin required';
  END IF;

  UPDATE public.clinics
  SET is_active = true,
      subscription_status = 'active',
      trial_starts_at = NULL,
      trial_ends_at = NULL,
      max_patients_allowed = NULL
  WHERE id = p_clinic_id
    AND (subscription_status IN ('pending','trial') OR subscription_status IS NULL);
END;
$$;

UPDATE public.clinics
SET subscription_status = 'active',
    trial_starts_at = NULL,
    trial_ends_at = NULL,
    max_patients_allowed = NULL
WHERE subscription_status = 'trial';

CREATE OR REPLACE FUNCTION public.enforce_patient_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Patient limits are currently not enforced; clinics get full access on activation.
  RETURN NEW;
END;
$$;
