CREATE OR REPLACE FUNCTION public.admin_create_therapist(
  p_full_name text,
  p_email text DEFAULT NULL,
  p_room text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_pin text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clinic uuid;
  v_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;
  v_clinic := public.get_clinic_id_safe();
  IF v_clinic IS NULL THEN RAISE EXCEPTION 'No clinic'; END IF;
  IF p_pin IS NULL OR length(p_pin) < 4 OR length(p_pin) > 8 OR p_pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'PIN must be 4-8 digits';
  END IF;

  INSERT INTO public.profiles (
    user_id, clinic_id, full_name, therapist_email, room,
    therapist_color, is_therapist, role, password_set, pin_hash
  ) VALUES (
    gen_random_uuid(), v_clinic, p_full_name, NULLIF(p_email,''), NULLIF(p_room,''),
    p_color, true, 'admin'::public.app_role, true,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 8))
  )
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_therapist_pin(p_therapist_profile_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_clinic uuid;
  v_target_clinic uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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
     SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
         is_therapist = true
   WHERE id = p_therapist_profile_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_therapist_pin(p_therapist_profile_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_clinic uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT pin_hash, clinic_id INTO v_hash, v_clinic
    FROM public.profiles
   WHERE id = p_therapist_profile_id AND is_therapist = true;
  IF v_hash IS NULL OR v_clinic IS NULL THEN RETURN false; END IF;
  IF v_clinic <> public.get_clinic_id_safe() THEN RETURN false; END IF;
  RETURN v_hash = extensions.crypt(p_pin, v_hash);
END;
$$;