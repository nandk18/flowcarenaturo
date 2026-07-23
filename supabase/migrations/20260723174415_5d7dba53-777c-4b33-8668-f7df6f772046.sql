
CREATE OR REPLACE FUNCTION public.analytics_overdue_counts(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_user_clinic uuid;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_overdue_calls int := 0;
  v_overdue_todos int := 0;
  v_care_appt int := 0;
  v_lead int := 0;
BEGIN
  SELECT role, clinic_id INTO v_role, v_user_clinic
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_clinic_id IS NOT NULL AND v_role <> 'super_admin' AND v_user_clinic <> p_clinic_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_clinic_id IS NULL AND v_role <> 'super_admin' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*) INTO v_care_appt
  FROM public.appointments
  WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
    AND care_call_required = true
    AND care_call_done = false
    AND care_call_due_date IS NOT NULL
    AND care_call_due_date < v_today;

  SELECT count(*) INTO v_lead
  FROM public.patients
  WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
    AND lead_status IN ('attempt1','attempt2','attempt3')
    AND call_due_date IS NOT NULL
    AND call_due_date < v_today;

  v_overdue_calls := v_care_appt + v_lead;

  SELECT count(*) INTO v_overdue_todos
  FROM public.todo_list
  WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
    AND coalesce(is_done, false) = false
    AND due_date IS NOT NULL
    AND due_date < v_today;

  RETURN jsonb_build_object(
    'overdue_calls', v_overdue_calls,
    'overdue_care_calls', v_care_appt,
    'overdue_lead_calls', v_lead,
    'overdue_todos', v_overdue_todos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_overdue_counts(uuid) TO authenticated;
