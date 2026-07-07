-- Trigger to remove/reduce invoice lines when an appointment is cancelled.
CREATE OR REPLACE FUNCTION public.remove_invoice_line_on_appointment_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_new_items jsonb;
  v_removed jsonb;
  v_line jsonb;
  v_subtotal numeric := 0;
  v_gst numeric := 0;
  v_total numeric := 0;
  v_unit numeric;
  v_qty numeric;
  v_gst_pct numeric;
  v_line_gst numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  FOR v_inv IN
    SELECT * FROM invoices
     WHERE clinic_id = NEW.clinic_id
       AND patient_id = NEW.patient_id
       AND status IN ('unpaid','partially_paid')
       AND line_items @> jsonb_build_array(jsonb_build_object('appointment_id', NEW.id::text))
        OR (clinic_id = NEW.clinic_id AND patient_id = NEW.patient_id
            AND status IN ('unpaid','partially_paid')
            AND appointment_id = NEW.id)
  LOOP
    v_new_items := '[]'::jsonb;
    v_subtotal := 0;
    v_gst := 0;
    v_total := 0;

    FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(v_inv.line_items, '[]'::jsonb))
    LOOP
      -- Keep the line if it isn't tied to this cancelled appointment.
      IF COALESCE(v_line->>'appointment_id','') <> NEW.id::text THEN
        v_new_items := v_new_items || v_line;
        v_unit := COALESCE((v_line->>'unit_price')::numeric, 0);
        v_qty := COALESCE((v_line->>'quantity')::numeric, 1);
        v_gst_pct := COALESCE((v_line->>'gst_percentage')::numeric, 0);
        v_line_gst := ROUND(v_unit * v_qty * v_gst_pct / 100, 2);
        v_subtotal := v_subtotal + (v_unit * v_qty);
        v_gst := v_gst + v_line_gst;
        v_total := v_total + (v_unit * v_qty) + v_line_gst;
      END IF;
    END LOOP;

    IF jsonb_array_length(v_new_items) = 0 AND COALESCE(v_inv.paid_amount,0) = 0 THEN
      DELETE FROM invoices WHERE id = v_inv.id;
    ELSE
      UPDATE invoices SET
        line_items = v_new_items,
        subtotal = v_subtotal,
        gst_amount = v_gst,
        total_amount = v_total,
        outstanding_amount = GREATEST(0, v_total - COALESCE(v_inv.paid_amount,0)),
        appointment_id = CASE WHEN v_inv.appointment_id = NEW.id THEN NULL ELSE v_inv.appointment_id END,
        updated_at = now()
      WHERE id = v_inv.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_remove_invoice_line_on_appointment_cancel ON public.appointments;
CREATE TRIGGER trg_remove_invoice_line_on_appointment_cancel
AFTER UPDATE ON public.appointments
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
EXECUTE FUNCTION public.remove_invoice_line_on_appointment_cancel();