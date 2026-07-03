
-- 1) Capacity-aware scheduling
CREATE OR REPLACE FUNCTION public.schedule_plan_sessions(p_plan_id uuid, p_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_plan treatment_plans%ROWTYPE;
  v_caller_clinic uuid;
  v_item treatment_plan_items%ROWTYPE;
  v_existing int;
  v_remaining int;
  v_to_create int;
  v_created int := 0;
  v_capacity_available int;
  v_max_per_day int;
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

    -- Capacity check
    SELECT max_per_day INTO v_max_per_day FROM invoice_services WHERE id = v_item.service_id;
    IF v_max_per_day IS NOT NULL THEN
      SELECT GREATEST(0, v_max_per_day - COUNT(*)::int)
        INTO v_capacity_available
        FROM therapy_sessions
       WHERE clinic_id = v_plan.clinic_id
         AND service_id = v_item.service_id
         AND session_date = p_date
         AND status <> 'cancelled';
      v_to_create := LEAST(v_to_create, v_capacity_available);
      IF v_to_create <= 0 THEN CONTINUE; END IF;
    END IF;

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

-- Helper: next working day (skip Sunday = dow 0)
CREATE OR REPLACE FUNCTION public.next_working_day(p_from date)
 RETURNS date
 LANGUAGE plpgsql
 IMMUTABLE
AS $$
DECLARE
  d date := p_from + 1;
BEGIN
  WHILE EXTRACT(DOW FROM d) = 0 LOOP
    d := d + 1;
  END LOOP;
  RETURN d;
END;
$$;

-- 2) Auto-roll: extend complete_therapy_session
CREATE OR REPLACE FUNCTION public.complete_therapy_session(p_session_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_session therapy_sessions%ROWTYPE;
  v_plan_item treatment_plan_items%ROWTYPE;
  v_all_done BOOLEAN;
  v_next_date date;
  v_next_created int := 0;
BEGIN
  SELECT * INTO v_session FROM therapy_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  UPDATE therapy_sessions SET
    status = 'completed',
    completed_at = now(),
    session_notes = COALESCE(p_notes, session_notes),
    updated_at = now()
  WHERE id = p_session_id;

  IF v_session.treatment_plan_item_id IS NOT NULL THEN
    UPDATE treatment_plan_items SET
      sessions_completed = sessions_completed + 1,
      status = CASE 
        WHEN sessions_completed + 1 >= total_sessions THEN 'completed'
        ELSE 'active'
      END,
      updated_at = now()
    WHERE id = v_session.treatment_plan_item_id
    RETURNING * INTO v_plan_item;

    -- Auto-roll: schedule next working day if item still has remaining sessions to schedule
    IF v_plan_item.status = 'active'
       AND COALESCE(v_plan_item.sessions_scheduled,0) < v_plan_item.total_sessions THEN
      v_next_date := public.next_working_day(v_session.session_date);
      BEGIN
        v_next_created := public.schedule_plan_sessions(v_session.treatment_plan_id, v_next_date);
      EXCEPTION WHEN OTHERS THEN
        v_next_created := 0;
      END;
    END IF;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM therapy_sessions
     WHERE patient_id = v_session.patient_id
       AND session_date = CURRENT_DATE
       AND status IN ('not_started','in_progress')
       AND clinic_id = v_session.clinic_id
  ) INTO v_all_done;

  IF v_all_done THEN
    INSERT INTO patient_idle_log (clinic_id, patient_id, treatment_plan_id, idle_started_at)
    VALUES (v_session.clinic_id, v_session.patient_id, v_session.treatment_plan_id, now());
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'all_done_today', v_all_done,
    'sessions_completed', COALESCE(v_plan_item.sessions_completed, 0),
    'total_sessions', COALESCE(v_plan_item.total_sessions, 0),
    'next_scheduled', v_next_created,
    'next_date', v_next_date
  );
END;
$$;

-- 3) Auto-assign therapists and rooms for a date
CREATE OR REPLACE FUNCTION public.auto_assign_sessions(p_clinic_id uuid, p_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_caller_clinic uuid;
  v_session RECORD;
  v_therapist_id uuid;
  v_therapist_room text;
  v_assigned int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_caller_clinic := public.get_clinic_id_safe();
  IF v_caller_clinic IS NULL OR v_caller_clinic <> p_clinic_id THEN
    RAISE EXCEPTION 'Not your clinic';
  END IF;

  FOR v_session IN
    SELECT id
      FROM therapy_sessions
     WHERE clinic_id = p_clinic_id
       AND session_date = p_date
       AND therapist_id IS NULL
       AND status = 'not_started'
     ORDER BY session_number
  LOOP
    SELECT p.id, p.room
      INTO v_therapist_id, v_therapist_room
      FROM public.profiles p
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
          FROM therapy_sessions ts
         WHERE ts.therapist_id = p.id
           AND ts.session_date = p_date
           AND ts.status <> 'cancelled'
      ) load ON true
     WHERE p.clinic_id = p_clinic_id
       AND p.is_therapist = true
     ORDER BY load.cnt ASC NULLS FIRST, p.full_name
     LIMIT 1;

    IF v_therapist_id IS NULL THEN EXIT; END IF;

    UPDATE therapy_sessions
       SET therapist_id = v_therapist_id,
           room = COALESCE(room, v_therapist_room),
           updated_at = now()
     WHERE id = v_session.id;
    v_assigned := v_assigned + 1;
  END LOOP;

  RETURN v_assigned;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_assign_sessions(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_working_day(date) TO authenticated, anon;

-- 4) Seed therapy_session_reminder template for new clinics; refresh seeder
CREATE OR REPLACE FUNCTION public.seed_default_message_templates(p_clinic_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO message_templates (clinic_id, type, name, message_body) VALUES
    (p_clinic_id, 'attempt1_reminder', 'Attempt 1 Call',
     'Hi {patient_name}, this is {clinic_name}. We noticed you recently enquired with us. We would love to help you on your health journey. Please call us at your convenience or reply to this message.'),
    (p_clinic_id, 'attempt2_reminder', 'Attempt 2 Call',
     'Hi {patient_name}, we tried reaching you earlier from {clinic_name}. We are here to help with your health needs. Please give us a call or let us know a good time to connect.'),
    (p_clinic_id, 'appointment_reminder', 'Appointment Reminder',
     'Hi {patient_name}, this is a reminder of your appointment tomorrow at {appointment_time} with {doctor_name} at {clinic_name}. Please reply to confirm or call us to reschedule.'),
    (p_clinic_id, 'patient_form_link', 'Patient Form Link',
     'Hi {patient_name}, welcome to {clinic_name}! Please take a moment to fill in your patient details using this link: {form_link}. This helps us serve you better. Link valid for 7 days.'),
    (p_clinic_id, 'appointment_confirmation', 'Appointment Confirmation',
     'Hi {patient_name}, your appointment at {clinic_name} is confirmed for {appointment_date} at {appointment_time} with {doctor_name}. See you soon!'),
    (p_clinic_id, 'invoice_payment', 'Invoice / Payment',
     'Hi {patient_name}, please find your invoice from {clinic_name}. Invoice No: {invoice_number} | Date: {invoice_date} | Total: {invoice_amount}. View here: {invoice_link}. Thank you!'),
    (p_clinic_id, 'care_call', 'Care Call',
     'Hi {patient_name}, this is {clinic_name}. We hope you are feeling well after your recent visit. We are checking in to see how you are doing. Please feel free to reach out if you need anything or would like to schedule a follow-up appointment.'),
    (p_clinic_id, 'appointment_cancelled_notice', 'Appointment Cancellation',
     'Hi {patient_name}, we regret to inform you that your appointment at {clinic_name} on {appointment_date} at {appointment_time} has been cancelled due to {reason}. Please contact us to reschedule at your earliest convenience.'),
    (p_clinic_id, 'therapy_session_reminder', 'Therapy Session Reminder',
     'Hi {patient_name}, this is a reminder for your therapy session ({service_name}) tomorrow at {clinic_name}. Please arrive 10 minutes early. Reply to confirm or reschedule.')
  ON CONFLICT (clinic_id, type) DO NOTHING;
END;
$$;
