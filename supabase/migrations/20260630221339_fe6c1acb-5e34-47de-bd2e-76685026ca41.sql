
-- 1. Reschedule tracking on appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS rescheduled_from uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rescheduled_to   uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

-- 2. Guard the auto-invoice trigger so reschedules don't create a duplicate invoice
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
BEGIN
  -- Skip invoice creation for rescheduled appointments (same visit, not billable again)
  IF NEW.rescheduled_from IS NOT NULL THEN
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

-- 3. Note templates: add template_type, description, is_default
ALTER TABLE public.note_templates
  ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT 'soap',
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS note_templates_one_default_per_clinic
  ON public.note_templates(clinic_id) WHERE is_default;

-- 4. Seed a Free-form system template if missing (clinic_id NULL = system template)
INSERT INTO public.note_templates (name, description, sections, is_system, template_type, clinic_id)
SELECT 'Free-form', 'Single free-text clinical notes (no SOAP sections)', '[]'::jsonb, true, 'freeform', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.note_templates WHERE name = 'Free-form' AND clinic_id IS NULL
);
