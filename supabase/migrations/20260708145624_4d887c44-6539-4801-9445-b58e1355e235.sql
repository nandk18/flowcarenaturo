-- Redefine idle detection: derive from live therapy_sessions instead of patient_idle_log.
-- A patient is idle if:
--   - has a not_started session TODAY
--   - has NO in_progress session TODAY
--   - > 20 minutes since last completed_at (or earliest not_started created_at if none completed)
CREATE OR REPLACE FUNCTION public.get_idle_patients(p_clinic_id uuid)
RETURNS TABLE(patient_id uuid, patient_name text, treatment_plan_id uuid, idle_minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH today_rows AS (
    SELECT * FROM therapy_sessions
     WHERE clinic_id = p_clinic_id
       AND session_date = CURRENT_DATE
       AND status <> 'cancelled'
  ),
  agg AS (
    SELECT
      t.patient_id,
      bool_or(t.status = 'in_progress') AS has_active,
      bool_or(t.status = 'not_started') AS has_pending,
      MAX(t.completed_at) FILTER (WHERE t.status = 'completed') AS last_completed,
      MIN(t.created_at) FILTER (WHERE t.status = 'not_started') AS earliest_pending_created,
      (array_agg(t.treatment_plan_id) FILTER (WHERE t.status = 'not_started'))[1] AS pending_plan_id
    FROM today_rows t
    GROUP BY t.patient_id
  )
  SELECT
    a.patient_id,
    TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')) AS patient_name,
    a.pending_plan_id AS treatment_plan_id,
    (EXTRACT(EPOCH FROM (now() - COALESCE(a.last_completed, a.earliest_pending_created)))/60)::int AS idle_minutes
  FROM agg a
  JOIN patients p ON p.id = a.patient_id
  WHERE a.has_pending
    AND NOT a.has_active
    AND COALESCE(a.last_completed, a.earliest_pending_created) IS NOT NULL
    AND EXTRACT(EPOCH FROM (now() - COALESCE(a.last_completed, a.earliest_pending_created))) > 1200
  ORDER BY COALESCE(a.last_completed, a.earliest_pending_created) ASC;
END;
$$;

-- complete_therapy_session no longer needs to write to patient_idle_log
-- (idle is now derived live). Keep everything else the same.
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
      sessions_scheduled = GREATEST(0, sessions_scheduled - 1),
      status = CASE WHEN sessions_completed + 1 >= total_sessions THEN 'completed' ELSE 'active' END,
      updated_at = now()
    WHERE id = v_session.treatment_plan_item_id
    RETURNING * INTO v_plan_item;
  END IF;

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
     ORDER BY created_at DESC LIMIT 1;

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

  -- Close any lingering open idle_log rows for this patient (defensive cleanup).
  UPDATE patient_idle_log SET idle_ended_at = now()
   WHERE patient_id = v_session.patient_id
     AND idle_ended_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'all_done_today', v_all_done,
    'sessions_completed', COALESCE(v_plan_item.sessions_completed, 0),
    'total_sessions', COALESCE(v_plan_item.total_sessions, 0),
    'sessions_remaining', COALESCE(v_plan_item.total_sessions - v_plan_item.sessions_completed, 0)
  );
END;
$function$;