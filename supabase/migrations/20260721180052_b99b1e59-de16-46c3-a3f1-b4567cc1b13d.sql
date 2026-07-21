
-- 1. Clinic active flag
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_reason text;

-- 2. Toggle RPC
CREATE OR REPLACE FUNCTION public.super_admin_set_clinic_active(
  p_clinic_id uuid, p_active boolean, p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super admin required';
  END IF;
  UPDATE public.clinics
     SET is_active      = p_active,
         disabled_at    = CASE WHEN p_active THEN NULL ELSE now() END,
         disabled_reason= CASE WHEN p_active THEN NULL ELSE p_reason END
   WHERE id = p_clinic_id;
END $$;

GRANT EXECUTE ON FUNCTION public.super_admin_set_clinic_active(uuid, boolean, text) TO authenticated;

-- 3. Per-clinic summary for Super Admin dashboard
CREATE OR REPLACE FUNCTION public.super_admin_clinic_summary()
RETURNS TABLE (
  clinic_id        uuid,
  clinic_name      text,
  is_active        boolean,
  disabled_at      timestamptz,
  disabled_reason  text,
  created_at       timestamptz,
  onboarding_complete boolean,
  users_count      bigint,
  patients_count   bigint,
  visits_7d        bigint,
  appts_7d         bigint,
  revenue_30d      numeric,
  last_activity    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super admin required';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.is_active,
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
END $$;

GRANT EXECUTE ON FUNCTION public.super_admin_clinic_summary() TO authenticated;

-- 4. Global recent audit activity for Super Admin
CREATE OR REPLACE FUNCTION public.super_admin_recent_activity(p_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  clinic_id uuid,
  clinic_name text,
  user_name text,
  user_role text,
  action text,
  resource_type text,
  resource_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Super admin required';
  END IF;

  RETURN QUERY
  SELECT al.id, al.created_at, al.clinic_id, c.name,
         al.user_name, al.user_role, al.action, al.resource_type, al.resource_name
    FROM public.audit_logs al
    LEFT JOIN public.clinics c ON c.id = al.clinic_id
   ORDER BY al.created_at DESC
   LIMIT LEAST(GREATEST(p_limit, 1), 500);
END $$;

GRANT EXECUTE ON FUNCTION public.super_admin_recent_activity(int) TO authenticated;

-- 5. Promote nandhakice@gmail.com if user exists
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nandhakice@gmail.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
       SET role = 'super_admin', clinic_id = NULL
     WHERE user_id = v_user_id;

    IF NOT FOUND THEN
      INSERT INTO public.profiles (user_id, full_name, role, clinic_id, password_set)
      VALUES (v_user_id, 'Super Admin', 'super_admin', NULL, true);
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
