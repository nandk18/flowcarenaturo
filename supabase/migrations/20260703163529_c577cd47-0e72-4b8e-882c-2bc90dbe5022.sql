
CREATE OR REPLACE FUNCTION public.schedule_plan_sessions(p_plan_id uuid, p_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan treatment_plans%ROWTYPE;
  v_caller_clinic uuid;
  v_item treatment_plan_items%ROWTYPE;
  v_existing int;
  v_remaining int;
  v_to_create int;
  v_created int := 0;
  n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_plan FROM treatment_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;

  v_caller_clinic := public.get_clinic_id_safe();
  IF v_caller_clinic IS NULL OR v_plan.clinic_id <> v_caller_clinic THEN
    RAISE EXCEPTION 'Plan not in your clinic';
  END IF;

  FOR v_item IN
    SELECT * FROM treatment_plan_items
     WHERE treatment_plan_id = p_plan_id
       AND COALESCE(status,'active') = 'active'
  LOOP
    SELECT COUNT(*) INTO v_existing
      FROM therapy_sessions
     WHERE treatment_plan_item_id = v_item.id
       AND session_date = p_date
       AND status <> 'cancelled';
    IF v_existing > 0 THEN CONTINUE; END IF;

    v_remaining := GREATEST(0, v_item.total_sessions - COALESCE(v_item.sessions_scheduled,0));
    v_to_create := LEAST(COALESCE(v_item.sessions_per_visit,1), v_remaining);
    IF v_to_create <= 0 THEN CONTINUE; END IF;

    FOR n IN 1..v_to_create LOOP
      INSERT INTO therapy_sessions (
        clinic_id, patient_id, treatment_plan_id, treatment_plan_item_id,
        service_id, service_name, session_date, session_number, status, amount
      ) VALUES (
        v_plan.clinic_id, v_plan.patient_id, v_plan.id, v_item.id,
        v_item.service_id, v_item.service_name, p_date,
        COALESCE(v_item.sessions_scheduled,0) + n, 'not_started',
        COALESCE(v_item.amount_per_session,0)
      );
      v_created := v_created + 1;
    END LOOP;

    UPDATE treatment_plan_items
       SET sessions_scheduled = COALESCE(sessions_scheduled,0) + v_to_create,
           updated_at = now()
     WHERE id = v_item.id;
  END LOOP;

  RETURN v_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_plan_sessions(uuid, date) TO authenticated;
