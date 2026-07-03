
-- Storage policies for therapy-photos bucket (clinic-scoped, path = clinic_id/session_id.jpg)
CREATE POLICY "therapy-photos read own clinic"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'therapy-photos'
  AND (storage.foldername(name))[1] = public.get_clinic_id_safe()::text
);

CREATE POLICY "therapy-photos insert own clinic"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'therapy-photos'
  AND (storage.foldername(name))[1] = public.get_clinic_id_safe()::text
);

CREATE POLICY "therapy-photos update own clinic"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'therapy-photos'
  AND (storage.foldername(name))[1] = public.get_clinic_id_safe()::text
);

CREATE POLICY "therapy-photos delete own clinic"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'therapy-photos'
  AND (storage.foldername(name))[1] = public.get_clinic_id_safe()::text
);

-- Ensure pgcrypto for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Admin sets/updates a therapist PIN (bcrypt-hashed).
-- Only admins in the same clinic can call this.
CREATE OR REPLACE FUNCTION public.admin_set_therapist_pin(
  p_therapist_profile_id uuid,
  p_pin text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_clinic uuid;
  v_target_clinic uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;

  v_caller_clinic := public.get_clinic_id_safe();
  SELECT clinic_id INTO v_target_clinic FROM public.profiles WHERE id = p_therapist_profile_id;

  IF v_target_clinic IS NULL OR v_target_clinic <> v_caller_clinic THEN
    RAISE EXCEPTION 'Therapist not in your clinic';
  END IF;

  IF p_pin IS NULL OR length(p_pin) < 4 OR length(p_pin) > 8 OR p_pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'PIN must be 4-8 digits';
  END IF;

  UPDATE public.profiles
     SET pin_hash = crypt(p_pin, gen_salt('bf', 8)),
         is_therapist = true
   WHERE id = p_therapist_profile_id;

  RETURN true;
END;
$$;

-- Public (auth-only) verification used by /therapist-login flow.
-- Verifies a PIN against a therapist profile in the caller's clinic.
CREATE OR REPLACE FUNCTION public.verify_therapist_pin(
  p_therapist_profile_id uuid,
  p_pin text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_clinic uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pin_hash, clinic_id INTO v_hash, v_clinic
    FROM public.profiles
   WHERE id = p_therapist_profile_id AND is_therapist = true;

  IF v_hash IS NULL OR v_clinic IS NULL THEN
    RETURN false;
  END IF;

  IF v_clinic <> public.get_clinic_id_safe() THEN
    RETURN false;
  END IF;

  RETURN v_hash = crypt(p_pin, v_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_therapist_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_therapist_pin(uuid, text) TO authenticated;

-- Enable realtime on therapy tables (idempotent guards)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.therapy_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_idle_log;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.treatment_plans;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.treatment_plan_items;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL;
  END;
END $$;
