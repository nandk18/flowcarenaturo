
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS lifestyle text,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS captured_at_reception boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.promote_patient_on_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patients
     SET lead_status = 'current'
   WHERE id = NEW.patient_id
     AND (lead_status IS NULL OR lead_status <> 'current');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_patient_on_appointment ON public.appointments;
CREATE TRIGGER trg_promote_patient_on_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.promote_patient_on_appointment();
