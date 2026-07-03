CREATE OR REPLACE FUNCTION public.admin_create_therapist(
  p_full_name text,
  p_email text DEFAULT NULL,
  p_room text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_pin text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
  v_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin required';
  END IF;

  v_clinic := public.get_clinic_id_safe();
  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'No clinic';
  END IF;

  IF p_pin IS NULL OR length(p_pin) < 4 OR length(p_pin) > 8 OR p_pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'PIN must be 4-8 digits';
  END IF;

  INSERT INTO public.profiles (
    user_id, clinic_id, full_name, therapist_email, room,
    therapist_color, is_therapist, role, password_set, pin_hash
  ) VALUES (
    gen_random_uuid(), v_clinic, p_full_name, NULLIF(p_email,''), NULLIF(p_room,''),
    p_color, true, 'admin'::public.app_role, true, crypt(p_pin, gen_salt('bf', 8))
  )
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_therapist(text,text,text,text,text) TO authenticated;