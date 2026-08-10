
-- 1. Follow-up stage tracking
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS followup_stage integer;

-- 2. Clinic settings PIN (private table, no client grants)
CREATE TABLE IF NOT EXISTS public.clinic_settings_pins (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.clinic_settings_pins TO service_role;
ALTER TABLE public.clinic_settings_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct client access" ON public.clinic_settings_pins
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.clinic_settings_pin_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clinic uuid; v_role text; v_row public.clinic_settings_pins;
BEGIN
  SELECT clinic_id, role::text INTO v_clinic, v_role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_clinic IS NULL THEN RETURN jsonb_build_object('allowed', false, 'is_set', false); END IF;
  SELECT * INTO v_row FROM public.clinic_settings_pins WHERE clinic_id = v_clinic;
  RETURN jsonb_build_object(
    'allowed', v_role IN ('admin','doctor','super_admin'),
    'role', v_role,
    'is_set', v_row.clinic_id IS NOT NULL,
    'locked_until', v_row.locked_until
  );
END $$;

CREATE OR REPLACE FUNCTION public.set_clinic_settings_pin(p_current_pin text, p_new_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clinic uuid; v_role text; v_hash text;
BEGIN
  SELECT clinic_id, role::text INTO v_clinic, v_role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_clinic IS NULL OR v_role NOT IN ('admin','doctor','super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
  END IF;
  IF p_new_pin IS NULL OR p_new_pin !~ '^[0-9]{4,6}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PIN must be 4-6 digits');
  END IF;
  SELECT pin_hash INTO v_hash FROM public.clinic_settings_pins WHERE clinic_id = v_clinic;
  IF v_hash IS NOT NULL THEN
    IF p_current_pin IS NULL OR v_hash <> extensions.crypt(p_current_pin, v_hash) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Current PIN is incorrect');
    END IF;
  END IF;
  INSERT INTO public.clinic_settings_pins (clinic_id, pin_hash, updated_by, failed_attempts, locked_until, updated_at)
  VALUES (v_clinic, extensions.crypt(p_new_pin, extensions.gen_salt('bf')), auth.uid(), 0, NULL, now())
  ON CONFLICT (clinic_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash, updated_by = EXCLUDED.updated_by,
        failed_attempts = 0, locked_until = NULL, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.verify_clinic_settings_pin(p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clinic uuid; v_role text; v_row public.clinic_settings_pins;
BEGIN
  SELECT clinic_id, role::text INTO v_clinic, v_role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_clinic IS NULL OR v_role NOT IN ('admin','doctor','super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
  END IF;
  SELECT * INTO v_row FROM public.clinic_settings_pins WHERE clinic_id = v_clinic;
  IF v_row.clinic_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'No PIN set'); END IF;
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many attempts. Try again later.', 'locked_until', v_row.locked_until);
  END IF;
  IF v_row.pin_hash = extensions.crypt(COALESCE(p_pin,''), v_row.pin_hash) THEN
    UPDATE public.clinic_settings_pins SET failed_attempts = 0, locked_until = NULL WHERE clinic_id = v_clinic;
    RETURN jsonb_build_object('ok', true);
  END IF;
  UPDATE public.clinic_settings_pins
     SET failed_attempts = failed_attempts + 1,
         locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '5 minutes' ELSE NULL END
   WHERE clinic_id = v_clinic;
  RETURN jsonb_build_object('ok', false, 'error', 'Incorrect PIN');
END $$;

CREATE OR REPLACE FUNCTION public.super_admin_reset_settings_pin(p_clinic_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
  END IF;
  DELETE FROM public.clinic_settings_pins WHERE clinic_id = p_clinic_id;
  INSERT INTO public.audit_logs (clinic_id, user_id, action, resource_type, resource_id, resource_name)
  VALUES (p_clinic_id, auth.uid(), 'settings_pin_reset', 'clinic', p_clinic_id, 'Settings PIN reset by super admin');
  RETURN jsonb_build_object('ok', true);
END $$;

-- 3. Follow-up conversion analytics
CREATE OR REPLACE FUNCTION public.analytics_followups(p_clinic_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public._analytics_can_access(p_clinic_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  WITH msgs AS (
    SELECT w.id, w.patient_id, COALESCE(w.followup_stage, 1) AS stage, w.created_at
      FROM public.whatsapp_messages w
     WHERE w.event = 'followup' AND w.status = 'sent'
       AND w.created_at::date BETWEEN p_from AND p_to
       AND (p_clinic_id IS NULL OR w.clinic_id = p_clinic_id)
  ),
  conv AS (
    SELECT m.stage,
           COUNT(*)::int AS sent,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM public.appointments a
              WHERE a.patient_id = m.patient_id
                AND a.status <> 'cancelled'
                AND a.created_at > m.created_at
                AND a.created_at <= m.created_at + interval '7 days'
           ))::int AS booked
      FROM msgs m GROUP BY m.stage
  ),
  by_stage AS (
    SELECT s.stage,
           COALESCE(c.sent,0)::int AS sent,
           COALESCE(c.booked,0)::int AS booked,
           CASE WHEN COALESCE(c.sent,0) = 0 THEN 0
                ELSE ROUND(c.booked::numeric * 100 / c.sent, 1) END AS rate
      FROM (SELECT generate_series(1,3) AS stage) s
      LEFT JOIN conv c ON c.stage = s.stage
     ORDER BY s.stage
  ),
  totals AS (
    SELECT COALESCE(SUM(sent),0)::int AS sent,
           COALESCE(SUM(booked),0)::int AS booked,
           CASE WHEN COALESCE(SUM(sent),0)=0 THEN 0
                ELSE ROUND(SUM(booked)::numeric * 100 / SUM(sent), 1) END AS rate
      FROM by_stage
  ),
  closed AS (
    SELECT COUNT(*)::int AS closed_patients
      FROM public.patients p
     WHERE p.lead_status = 'closed'
       AND (p_clinic_id IS NULL OR p.clinic_id = p_clinic_id)
       AND EXISTS (SELECT 1 FROM msgs m WHERE m.patient_id = p.id)
  )
  SELECT jsonb_build_object(
    'by_stage', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM by_stage b), '[]'::jsonb),
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'closed', (SELECT to_jsonb(c) FROM closed c)
  ) INTO v_result;
  RETURN v_result;
END $$;

-- 4. Treatment package completion added to analytics_treatments
CREATE OR REPLACE FUNCTION public.analytics_treatments(p_clinic_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public._analytics_can_access(p_clinic_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  WITH ses AS (
    SELECT * FROM therapy_sessions
     WHERE session_date BETWEEN p_from AND p_to
       AND (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
  ),
  totals AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='completed')::int AS completed,
      COUNT(*) FILTER (WHERE status='in_progress')::int AS in_progress,
      COUNT(*) FILTER (WHERE status='not_started')::int AS not_started,
      COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled,
      COUNT(DISTINCT patient_id)::int AS unique_patients
      FROM ses
  ),
  daily AS (
    SELECT session_date::text AS d,
           COUNT(*) FILTER (WHERE status='completed') AS completed,
           COUNT(*) FILTER (WHERE status='cancelled') AS cancelled,
           COUNT(*) AS total
      FROM ses GROUP BY 1 ORDER BY 1
  ),
  by_service AS (
    SELECT service_name AS service,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status='completed') AS completed
      FROM ses GROUP BY 1 ORDER BY total DESC LIMIT 10
  ),
  plans AS (
    SELECT
      COUNT(*)::int AS total_plans,
      COUNT(*) FILTER (WHERE status='completed')::int AS completed_plans,
      COUNT(*) FILTER (WHERE status='active')::int AS active_plans
      FROM treatment_plans
     WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
       AND created_at::date BETWEEN p_from AND p_to
  ),
  adherence AS (
    SELECT
      COALESCE(SUM(sessions_completed),0)::int AS done,
      COALESCE(SUM(total_sessions),0)::int AS planned
      FROM treatment_plan_items
     WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
       AND created_at::date BETWEEN p_from AND p_to
  ),
  plan_pct AS (
    SELECT tp.id,
           CASE WHEN COALESCE(SUM(i.total_sessions),0) = 0 THEN 0
                ELSE LEAST(100, ROUND(SUM(COALESCE(i.sessions_completed,0))::numeric * 100
                                      / SUM(i.total_sessions), 1)) END AS pct
      FROM treatment_plans tp
      JOIN treatment_plan_items i ON i.treatment_plan_id = tp.id
     WHERE (p_clinic_id IS NULL OR tp.clinic_id = p_clinic_id)
       AND tp.created_at::date BETWEEN p_from AND p_to
     GROUP BY tp.id
  ),
  package AS (
    SELECT
      COUNT(*)::int AS plans,
      COALESCE(ROUND(AVG(pct), 1), 0) AS avg_completion,
      COUNT(*) FILTER (WHERE pct >= 100)::int AS fully_completed,
      COUNT(*) FILTER (WHERE pct < 25)::int AS b0_25,
      COUNT(*) FILTER (WHERE pct >= 25 AND pct < 50)::int AS b25_50,
      COUNT(*) FILTER (WHERE pct >= 50 AND pct < 75)::int AS b50_75,
      COUNT(*) FILTER (WHERE pct >= 75 AND pct < 100)::int AS b75_99,
      COUNT(*) FILTER (WHERE pct >= 100)::int AS b100
      FROM plan_pct
  )
  SELECT jsonb_build_object(
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily d),'[]'::jsonb),
    'by_service', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM by_service s),'[]'::jsonb),
    'plans', (SELECT to_jsonb(p) FROM plans p),
    'adherence', (SELECT to_jsonb(a) FROM adherence a),
    'package', (SELECT to_jsonb(pk) FROM package pk)
  ) INTO v_result;
  RETURN v_result;
END $$;
