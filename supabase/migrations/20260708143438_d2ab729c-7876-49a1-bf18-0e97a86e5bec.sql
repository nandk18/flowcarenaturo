CREATE OR REPLACE FUNCTION public.auto_create_invoice_on_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  v_has_therapy_line BOOLEAN;
BEGIN
  IF NEW.rescheduled_from IS NOT NULL THEN
    RETURN NEW;
  END IF;

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

  -- Find an existing unpaid invoice for this patient/day, but SKIP therapy-completion invoices
  -- (those with any line_item containing therapy_session_id). Therapy invoices are only
  -- appended to by complete_therapy_session.
  SELECT * INTO v_existing_invoice FROM invoices i
   WHERE i.clinic_id = NEW.clinic_id AND i.patient_id = NEW.patient_id
     AND i.invoice_date = NEW.appointment_date AND i.status = 'unpaid'
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(COALESCE(i.line_items,'[]'::jsonb)) li
        WHERE li ? 'therapy_session_id'
     )
   ORDER BY i.created_at DESC LIMIT 1;

  IF v_existing_invoice.id IS NOT NULL THEN
    v_line_items   := v_existing_invoice.line_items || jsonb_build_array(v_new_item);
    v_new_subtotal := v_existing_invoice.subtotal + COALESCE(v_service.amount,0);
    v_new_gst      := v_existing_invoice.gst_amount + v_gst_amount;
    v_new_total    := v_existing_invoice.total_amount + v_item_total;

    -- Do NOT overwrite appointment_id on the existing invoice; the earlier appointment
    -- link is preserved. Doctor stays as-is unless it was NULL.
    UPDATE invoices SET
      line_items = v_line_items, subtotal = v_new_subtotal, gst_amount = v_new_gst,
      total_amount = v_new_total, outstanding_amount = v_new_total - v_existing_invoice.paid_amount,
      doctor_id = COALESCE(v_existing_invoice.doctor_id, NEW.doctor_id),
      updated_at = now()
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