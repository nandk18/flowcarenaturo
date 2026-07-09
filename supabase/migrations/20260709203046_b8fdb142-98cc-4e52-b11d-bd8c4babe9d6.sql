
CREATE OR REPLACE FUNCTION public.sync_appointment_status_from_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt_id uuid;
  v_total int;
  v_completed int;
  v_cancelled int;
  v_in_progress int;
  v_current_status text;
  v_new_status text;
BEGIN
  v_appt_id := COALESCE(NEW.appointment_id, OLD.appointment_id);
  IF v_appt_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE status = 'in_progress')
  INTO v_total, v_completed, v_cancelled, v_in_progress
  FROM public.therapy_sessions
  WHERE appointment_id = v_appt_id;

  IF v_total = 0 THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT status INTO v_current_status FROM public.appointments WHERE id = v_appt_id;

  IF v_cancelled = v_total THEN
    v_new_status := 'cancelled';
  ELSIF v_completed + v_cancelled = v_total AND v_completed > 0 THEN
    v_new_status := 'completed';
  ELSIF v_in_progress > 0 THEN
    v_new_status := 'in_progress';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_current_status IS DISTINCT FROM v_new_status THEN
    UPDATE public.appointments
       SET status = v_new_status, updated_at = now()
     WHERE id = v_appt_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_status ON public.therapy_sessions;
CREATE TRIGGER trg_sync_appointment_status
AFTER INSERT OR UPDATE OF status OR DELETE ON public.therapy_sessions
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_status_from_sessions();
