
CREATE OR REPLACE FUNCTION public.complete_therapy_session(p_session_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session therapy_sessions%ROWTYPE;
  v_plan_item treatment_plan_items%ROWTYPE;
  v_all_done BOOLEAN;
  v_next_date date;
  v_next_created int := 0;
  v_svc invoice_services%ROWTYPE;
  v_amount numeric;
  v_gst_pct numeric;
  v_gst_amount numeric;
  v_line_total numeric;
  v_new_item jsonb;
  v_inv invoices%ROWTYPE;
  v_new_line_items jsonb;
  v_invoice_num text;
  v_count integer;
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

  -- Bill on completion: append to today's open invoice, or create new
  v_amount := COALESCE(v_session.amount, 0);
  IF v_amount > 0 THEN
    IF v_session.service_id IS NOT NULL THEN
      SELECT * INTO v_svc FROM invoice_services WHERE id = v_session.service_id;
    END IF;
    v_gst_pct := COALESCE(v_svc.gst_percentage, 0);
    v_gst_amount := ROUND(v_amount * v_gst_pct / 100, 2);
    v_line_total := v_amount + v_gst_amount;

    v_new_item := jsonb_build_object(
      'name', v_session.service_name,
      'description', COALESCE(v_svc.description, ''),
      'quantity', 1,
      'unit_price', v_amount,
      'gst_percentage', v_gst_pct,
      'total', v_line_total,
      'service_id', v_session.service_id,
      'therapy_session_id', v_session.id,
      'visit_date', v_session.session_date
    );

    SELECT * INTO v_inv FROM invoices
     WHERE clinic_id = v_session.clinic_id
       AND patient_id = v_session.patient_id
       AND invoice_date = CURRENT_DATE
       AND status = 'unpaid'
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_inv.id IS NOT NULL THEN
      v_new_line_items := COALESCE(v_inv.line_items, '[]'::jsonb) || jsonb_build_array(v_new_item);
      UPDATE invoices SET
        line_items = v_new_line_items,
        subtotal = COALESCE(subtotal, 0) + v_amount,
        gst_amount = COALESCE(gst_amount, 0) + v_gst_amount,
        total_amount = COALESCE(total_amount, 0) + v_line_total,
        outstanding_amount = COALESCE(outstanding_amount, 0) + v_line_total,
        pdf_url = NULL,
        pdf_generated_at = NULL,
        updated_at = now()
      WHERE id = v_inv.id;
    ELSE
      SELECT COUNT(*)+1 INTO v_count FROM invoices WHERE clinic_id = v_session.clinic_id;
      v_invoice_num := 'INV-' || TO_CHAR(CURRENT_DATE,'YYYY') || '-' || LPAD(v_count::TEXT,4,'0');
      INSERT INTO invoices (
        clinic_id, patient_id, invoice_number, invoice_date,
        line_items, subtotal, gst_percentage, gst_amount, discount_amount, total_amount,
        outstanding_amount, paid_amount, status
      ) VALUES (
        v_session.clinic_id, v_session.patient_id, v_invoice_num, CURRENT_DATE,
        jsonb_build_array(v_new_item), v_amount, v_gst_pct, v_gst_amount,
        0, v_line_total, v_line_total, 0, 'unpaid'
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
    'next_scheduled', v_next_created,
    'next_date', v_next_date
  );
END;
$function$;
