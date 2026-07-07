
-- 1. Add columns to therapy_sessions and treatment_plan_items
ALTER TABLE public.therapy_sessions
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_therapy_sessions_appointment_id
  ON public.therapy_sessions(appointment_id);

ALTER TABLE public.treatment_plan_items
  ADD COLUMN IF NOT EXISTS notes text;

-- 2. Update auto_create_invoice_on_appointment trigger:
--    Skip invoice creation when ALL linked appointment_services are of type 'treatment'.
--    Consult behavior (or no linked services) is unchanged.
CREATE OR REPLACE FUNCTION public.auto_create_invoice_on_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_service         invoice_services%ROWTYPE;
  v_existing_invoice invoices%ROWTYPE;
  v_invoice_num     TEXT;
  v_count           INTEGER;
  v_line_items      JSONB;
  v_new_item        JSONB;
  v_gst_amount      NUMERIC;
  v_item_total      NUMERIC;
  v_new_subtotal    NUMERIC;
  v_new_gst         NUMERIC;
  v_new_total       NUMERIC;
  v_linked_total    INTEGER;
  v_treatment_only  BOOLEAN;
BEGIN
  -- Skip invoice creation for rescheduled appointments
  IF NEW.rescheduled_from IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- If the appointment has linked services and ALL of them are 'treatment',
  -- skip invoice creation entirely — treatments are invoiced on session completion.
  SELECT COUNT(*),
         COUNT(*) FILTER (
           WHERE COALESCE(isv.service_type,'consultation') = 'treatment'
         ) = COUNT(*)
    INTO v_linked_total, v_treatment_only
  FROM public.appointment_services aps
  LEFT JOIN public.invoice_services isv ON isv.id = aps.service_id
  WHERE aps.appointment_id = NEW.id;

  IF COALESCE(v_linked_total, 0) > 0 AND COALESCE(v_treatment_only, false) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_service FROM invoice_services
   WHERE clinic_id = NEW.clinic_id AND is_active = true
   ORDER BY is_default DESC, created_at ASC LIMIT 1;

  v_gst_amount := ROUND(COALESCE(v_service.amount,0) * COALESCE(v_service.gst_percentage,0) / 100, 2);
  v_item_total := COALESCE(v_service.amount,0) + v_gst_amount;

  v_new_item := jsonb_build_object(
    'name', COALESCE(v_service.name,'Consultation'),
    'description', COALESCE(v_service.description,''),
    'quantity', 1,
    'unit_price', COALESCE(v_service.amount,0),
    'gst_percentage', COALESCE(v_service.gst_percentage,0),
    'total', v_item_total,
    'appointment_id', NEW.id,
    'visit_date', NEW.appointment_date
  );

  SELECT * INTO v_existing_invoice FROM invoices
   WHERE clinic_id = NEW.clinic_id AND patient_id = NEW.patient_id
     AND invoice_date = NEW.appointment_date AND status = 'unpaid'
   ORDER BY created_at DESC LIMIT 1;

  IF v_existing_invoice.id IS NOT NULL THEN
    v_line_items   := v_existing_invoice.line_items || jsonb_build_array(v_new_item);
    v_new_subtotal := v_existing_invoice.subtotal + COALESCE(v_service.amount,0);
    v_new_gst      := v_existing_invoice.gst_amount + v_gst_amount;
    v_new_total    := v_existing_invoice.total_amount + v_item_total;

    UPDATE invoices SET
      line_items = v_line_items, subtotal = v_new_subtotal, gst_amount = v_new_gst,
      total_amount = v_new_total, outstanding_amount = v_new_total - v_existing_invoice.paid_amount,
      appointment_id = NEW.id, doctor_id = NEW.doctor_id, updated_at = now()
    WHERE id = v_existing_invoice.id;
  ELSE
    v_line_items := jsonb_build_array(v_new_item);
    SELECT COUNT(*)+1 INTO v_count FROM invoices WHERE clinic_id = NEW.clinic_id;
    v_invoice_num := 'INV-' || TO_CHAR(NEW.appointment_date,'YYYY') || '-' || LPAD(v_count::TEXT,4,'0');

    INSERT INTO invoices (
      clinic_id, patient_id, appointment_id, doctor_id, invoice_number, invoice_date,
      line_items, subtotal, gst_percentage, gst_amount, discount_amount, total_amount,
      outstanding_amount, paid_amount, status, created_by
    ) VALUES (
      NEW.clinic_id, NEW.patient_id, NEW.id, NEW.doctor_id, v_invoice_num, NEW.appointment_date,
      v_line_items, COALESCE(v_service.amount,0), COALESCE(v_service.gst_percentage,0), v_gst_amount,
      0, v_item_total, v_item_total, 0, 'unpaid', NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Update complete_therapy_session to append/create invoice line on completion.
CREATE OR REPLACE FUNCTION public.complete_therapy_session(p_session_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_session therapy_sessions%ROWTYPE;
  v_plan_item treatment_plan_items%ROWTYPE;
  v_all_done BOOLEAN;
  v_existing_invoice invoices%ROWTYPE;
  v_service invoice_services%ROWTYPE;
  v_gst_pct NUMERIC := 0;
  v_gst_amount NUMERIC := 0;
  v_item_total NUMERIC := 0;
  v_line_item JSONB;
  v_new_line_items JSONB;
  v_count INTEGER;
  v_invoice_num TEXT;
BEGIN
  SELECT * INTO v_session
  FROM therapy_sessions
  WHERE id = p_session_id;

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
      sessions_scheduled = GREATEST(0, sessions_scheduled - 1),
      status = CASE
        WHEN sessions_completed + 1 >= total_sessions THEN 'completed'
        ELSE 'active'
      END,
      updated_at = now()
    WHERE id = v_session.treatment_plan_item_id
    RETURNING * INTO v_plan_item;
  END IF;

  -- Invoice on completion: append line to today's open unpaid invoice, else create one.
  IF COALESCE(v_session.amount, 0) > 0 THEN
    IF v_session.service_id IS NOT NULL THEN
      SELECT * INTO v_service FROM invoice_services WHERE id = v_session.service_id;
      v_gst_pct := COALESCE(v_service.gst_percentage, 0);
    END IF;
    v_gst_amount := ROUND(v_session.amount * v_gst_pct / 100, 2);
    v_item_total := v_session.amount + v_gst_amount;

    v_line_item := jsonb_build_object(
      'name', v_session.service_name,
      'description', 'Therapy session',
      'quantity', 1,
      'unit_price', v_session.amount,
      'gst_percentage', v_gst_pct,
      'total', v_item_total,
      'therapy_session_id', v_session.id,
      'visit_date', v_session.session_date
    );

    SELECT * INTO v_existing_invoice FROM invoices
     WHERE clinic_id = v_session.clinic_id
       AND patient_id = v_session.patient_id
       AND invoice_date = CURRENT_DATE
       AND status = 'unpaid'
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_existing_invoice.id IS NOT NULL THEN
      v_new_line_items := v_existing_invoice.line_items || jsonb_build_array(v_line_item);
      UPDATE invoices SET
        line_items = v_new_line_items,
        subtotal = v_existing_invoice.subtotal + v_session.amount,
        gst_amount = v_existing_invoice.gst_amount + v_gst_amount,
        total_amount = v_existing_invoice.total_amount + v_item_total,
        outstanding_amount = (v_existing_invoice.total_amount + v_item_total) - v_existing_invoice.paid_amount,
        updated_at = now()
      WHERE id = v_existing_invoice.id;
    ELSE
      SELECT COUNT(*) + 1 INTO v_count FROM invoices WHERE clinic_id = v_session.clinic_id;
      v_invoice_num := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_count::TEXT, 4, '0');

      INSERT INTO invoices (
        clinic_id, patient_id, invoice_number, invoice_date,
        line_items, subtotal, gst_percentage, gst_amount, discount_amount,
        total_amount, outstanding_amount, paid_amount, status
      ) VALUES (
        v_session.clinic_id, v_session.patient_id, v_invoice_num, CURRENT_DATE,
        jsonb_build_array(v_line_item), v_session.amount, v_gst_pct, v_gst_amount, 0,
        v_item_total, v_item_total, 0, 'unpaid'
      );
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
    'sessions_remaining', COALESCE(v_plan_item.total_sessions - v_plan_item.sessions_completed, 0)
  );
END;
$function$;
