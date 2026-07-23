
CREATE OR REPLACE FUNCTION public.analytics_overdue_counts(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_care int := 0;
  v_lead int := 0;
  v_todos int := 0;
BEGIN
  IF NOT public._analytics_can_access(p_clinic_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT count(*) INTO v_care FROM public.appointments
   WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
     AND care_call_required = true AND care_call_done = false
     AND care_call_due_date IS NOT NULL AND care_call_due_date < v_today;

  SELECT count(*) INTO v_lead FROM public.patients
   WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
     AND lead_status IN ('attempt1','attempt2','attempt3')
     AND call_due_date IS NOT NULL AND call_due_date < v_today;

  SELECT count(*) INTO v_todos FROM public.todo_list
   WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
     AND coalesce(is_done, false) = false
     AND due_date IS NOT NULL AND due_date < v_today;

  RETURN jsonb_build_object(
    'overdue_calls', v_care + v_lead,
    'overdue_care_calls', v_care,
    'overdue_lead_calls', v_lead,
    'overdue_todos', v_todos
  );
END $function$;
