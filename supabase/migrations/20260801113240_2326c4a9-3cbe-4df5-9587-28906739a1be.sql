CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid,
  event text NOT NULL,
  to_phone text,
  template_sid text,
  twilio_sid text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_messages_appt ON public.whatsapp_messages(appointment_id, event);
CREATE INDEX idx_whatsapp_messages_clinic ON public.whatsapp_messages(clinic_id, created_at DESC);

GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view their clinic whatsapp messages"
ON public.whatsapp_messages FOR SELECT TO authenticated
USING (clinic_id IN (SELECT p.clinic_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.set_whatsapp_messages_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER update_whatsapp_messages_updated_at
BEFORE UPDATE ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_messages_updated_at();

CREATE OR REPLACE FUNCTION public.notify_appointment_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://amipgrjksrszocfzucxn.supabase.co/functions/v1/send-appointment-whatsapp';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaXBncmprc3Jzem9jZnp1Y3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTI0NDIsImV4cCI6MjA5NjIyODQ0Mn0.-iFJ_US4PR9SBTyZyMetOtJ4N3nyvE0foeS-0BvSjBU';
  v_event text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status, 'scheduled') IN ('cancelled', 'completed') THEN
      RETURN NEW;
    END IF;
    v_event := 'booked';
  ELSE
    IF NEW.status = 'cancelled' AND COALESCE(OLD.status, '') <> 'cancelled' THEN
      v_event := 'cancelled';
    ELSIF (NEW.appointment_date IS DISTINCT FROM OLD.appointment_date
           OR NEW.appointment_time IS DISTINCT FROM OLD.appointment_time)
          AND COALESCE(NEW.status, '') <> 'cancelled' THEN
      v_event := 'rescheduled';
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon
    ),
    body := jsonb_build_object(
      'appointment_id', NEW.id,
      'event', v_event
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointment_whatsapp ON public.appointments;
CREATE TRIGGER trg_appointment_whatsapp
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_whatsapp();