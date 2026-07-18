
CREATE OR REPLACE FUNCTION public.flag_treatment_gap_care_calls(p_clinic_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_flagged int := 0;
  v_cleared int := 0;
  r RECORD;
  v_appt_id uuid;
BEGIN
  -- Auto-clear: any currently-flagged appointment where the patient has a newer
  -- non-cancelled session or non-cancelled appointment.
  UPDATE appointments a
     SET care_call_done = true
   WHERE a.clinic_id = p_clinic_id
     AND a.care_call_required = true
     AND a.care_call_done = false
     AND (
       EXISTS (
         SELECT 1 FROM therapy_sessions ts
          WHERE ts.patient_id = a.patient_id
            AND ts.clinic_id = p_clinic_id
            AND ts.status <> 'cancelled'
            AND ts.session_date > a.appointment_date
       )
       OR EXISTS (
         SELECT 1 FROM appointments a2
          WHERE a2.patient_id = a.patient_id
            AND a2.clinic_id = p_clinic_id
            AND a2.id <> a.id
            AND a2.status <> 'cancelled'
            AND a2.appointment_date > a.appointment_date
       )
     );
  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  -- Flag: patients whose latest completed therapy session was 10+ days ago
  -- and who have no non-cancelled session/appointment since.
  FOR r IN
    WITH last_completed AS (
      SELECT DISTINCT ON (ts.patient_id)
             ts.patient_id,
             ts.completed_at,
             ts.session_date,
             ts.id AS session_id
        FROM therapy_sessions ts
       WHERE ts.clinic_id = p_clinic_id
         AND ts.status = 'completed'
         AND ts.completed_at IS NOT NULL
       ORDER BY ts.patient_id, ts.completed_at DESC
    )
    SELECT lc.*
      FROM last_completed lc
     WHERE lc.completed_at < now() - interval '10 days'
       AND NOT EXISTS (
         SELECT 1 FROM therapy_sessions ts2
          WHERE ts2.patient_id = lc.patient_id
            AND ts2.clinic_id = p_clinic_id
            AND ts2.status <> 'cancelled'
            AND ts2.session_date > lc.session_date
       )
       AND NOT EXISTS (
         SELECT 1 FROM appointments a3
          WHERE a3.patient_id = lc.patient_id
            AND a3.clinic_id = p_clinic_id
            AND a3.status <> 'cancelled'
            AND a3.appointment_date > lc.session_date
       )
       AND NOT EXISTS (
         SELECT 1 FROM appointments a4
          WHERE a4.patient_id = lc.patient_id
            AND a4.clinic_id = p_clinic_id
            AND a4.care_call_required = true
            AND a4.care_call_done = false
       )
  LOOP
    -- Choose the appointment on the same date as the last completed session,
    -- else the most recent past appointment for that patient.
    SELECT id INTO v_appt_id
      FROM appointments
     WHERE clinic_id = p_clinic_id
       AND patient_id = r.patient_id
       AND appointment_date = r.session_date
       AND status <> 'cancelled'
     ORDER BY appointment_time DESC NULLS LAST
     LIMIT 1;

    IF v_appt_id IS NULL THEN
      SELECT id INTO v_appt_id
        FROM appointments
       WHERE clinic_id = p_clinic_id
         AND patient_id = r.patient_id
         AND status <> 'cancelled'
       ORDER BY appointment_date DESC, appointment_time DESC NULLS LAST
       LIMIT 1;
    END IF;

    IF v_appt_id IS NOT NULL THEN
      UPDATE appointments
         SET care_call_required = true,
             care_call_done = false,
             care_call_due_date = CURRENT_DATE
       WHERE id = v_appt_id;
      v_flagged := v_flagged + 1;
    END IF;
  END LOOP;

  RETURN v_flagged;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flag_treatment_gap_care_calls(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.flag_all_treatment_gap_care_calls()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c RECORD;
  v_total int := 0;
BEGIN
  FOR c IN SELECT id FROM public.clinics LOOP
    v_total := v_total + COALESCE(public.flag_treatment_gap_care_calls(c.id), 0);
  END LOOP;
  RETURN v_total;
END;
$$;
