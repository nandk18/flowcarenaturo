-- 1. Subscription fields on clinics
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'pending'
    CHECK (subscription_status IN ('pending', 'trial', 'active', 'past_due', 'cancelled', 'disabled')),
  ADD COLUMN IF NOT EXISTS plan_tier text
    CHECK (plan_tier IN ('pro', 'custom')),
  ADD COLUMN IF NOT EXISTS billing_cycle text
    CHECK (billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS trial_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text,
  ADD COLUMN IF NOT EXISTS max_patients_allowed int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_region text DEFAULT 'IN';

-- 2. New clinics start inactive and pending approval
ALTER TABLE public.clinics ALTER COLUMN is_active SET DEFAULT false;

-- 3. Backfill existing active clinics so they keep working
UPDATE public.clinics
SET subscription_status = 'active'
WHERE is_active = true AND subscription_status IS NULL;

-- 4. Helper: is the clinic currently usable (active subscription or valid trial)
CREATE OR REPLACE FUNCTION public.is_subscription_active(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinics c
    WHERE c.id = p_clinic_id
      AND c.is_active = true
      AND (
        c.subscription_status = 'active'
        OR (
          c.subscription_status = 'trial'
          AND c.trial_ends_at > now()
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_subscription_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_subscription_active(uuid) TO service_role;

-- 5. Onboarding now creates a pending clinic awaiting Super Admin activation
CREATE OR REPLACE FUNCTION public.complete_clinic_onboarding(
  p_clinic_name text,
  p_clinic_address text DEFAULT NULL,
  p_clinic_phone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_user_id   uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clinic_id := (
    SELECT clinic_id 
    FROM public.profiles 
    WHERE user_id = v_user_id 
    LIMIT 1
  );

  IF v_clinic_id IS NOT NULL THEN
    RETURN v_clinic_id;
  END IF;

  WITH inserted AS (
    INSERT INTO public.clinics (
      name,
      address,
      phone,
      is_active,
      subscription_status
    )
    VALUES (
      p_clinic_name,
      p_clinic_address,
      p_clinic_phone,
      false,
      'pending'
    )
    RETURNING id
  )
  SELECT id INTO v_clinic_id FROM inserted;

  UPDATE public.profiles 
  SET clinic_id = v_clinic_id 
  WHERE user_id = v_user_id;

  RETURN v_clinic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_clinic_onboarding(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_clinic_onboarding(text, text, text) TO service_role;

-- 6. Explicit Super Admin activation that starts a 7-day trial
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
      subscription_status = 'trial',
      trial_starts_at = now(),
      trial_ends_at = now() + interval '7 days'
  WHERE id = p_clinic_id
    AND (subscription_status = 'pending' OR subscription_status IS NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_activate_clinic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_activate_clinic(uuid) TO service_role;

-- 7. Update the enable/disable RPC so re-enabling a disabled clinic works,
--    but does not overwrite an existing trial
CREATE OR REPLACE FUNCTION public.super_admin_set_clinic_active(
  p_clinic_id uuid,
  p_active boolean,
  p_reason text DEFAULT NULL
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
  SET is_active = p_active,
      disabled_at = CASE WHEN p_active THEN NULL ELSE now() END,
      disabled_reason = CASE WHEN p_active THEN NULL ELSE p_reason END,
      subscription_status = CASE
        WHEN NOT p_active THEN 'disabled'
        WHEN p_active AND (subscription_status = 'disabled' OR subscription_status IS NULL) THEN 'trial'
        ELSE subscription_status
      END,
      trial_starts_at = CASE
        WHEN p_active AND trial_starts_at IS NULL THEN now()
        ELSE trial_starts_at
      END,
      trial_ends_at = CASE
        WHEN p_active AND trial_ends_at IS NULL THEN now() + interval '7 days'
        ELSE trial_ends_at
      END
  WHERE id = p_clinic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_set_clinic_active(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_set_clinic_active(uuid, boolean, text) TO service_role;