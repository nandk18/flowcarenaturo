CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_profile public.profiles;
  v_role public.app_role;
  v_full_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, v_profile.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN v_profile;
  END IF;

  v_role := CASE
    WHEN auth.jwt()->'user_metadata'->>'invited_role' = 'super_admin' THEN 'super_admin'::public.app_role
    ELSE 'admin'::public.app_role
  END;

  v_full_name := COALESCE(
    NULLIF(auth.jwt()->'user_metadata'->>'full_name', ''),
    NULLIF(auth.jwt()->>'email', ''),
    'FlowCare user'
  );

  INSERT INTO public.profiles (user_id, full_name, role, clinic_id, lab_id, password_set)
  VALUES (v_user_id, v_full_name, v_role, NULL, NULL, true)
  RETURNING * INTO v_profile;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO service_role;