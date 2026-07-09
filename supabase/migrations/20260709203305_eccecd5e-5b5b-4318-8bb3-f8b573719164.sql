CREATE OR REPLACE FUNCTION public.sync_appointment_status_from_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt_id uuid;
  v_total int;
  v_cancelled int;
  v_completed int;
  v_in_progress int;
  v_new_status text;
BEGIN
  v_appt_id := COALESCE(NEW.appointment_id, OLD.appointment_id);
  IF v_appt_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'in_progress')
  INTO v_total, v_cancelled, v_completed, v_in_progress
  FROM public.therapy_sessions
  WHERE appointment_id = v_appt_id;

  IF v_total = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_cancelled = v_total THEN
    v_new_status := 'cancelled';
  ELSIF v_completed + v_cancelled = v_total AND v_completed > 0 THEN
    v_new_status := 'completed';
  ELSIF v_in_progress > 0 OR v_completed > 0 THEN
    v_new_status := 'in_progress';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.appointments
  SET status = v_new_status
  WHERE id = v_appt_id AND status IS DISTINCT FROM v_new_status;

  RETURN COALESCE(NEW, OLD);
END;
$$;