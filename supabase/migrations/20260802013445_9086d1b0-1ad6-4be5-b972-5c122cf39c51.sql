BEGIN;

-- Add therapy_session_id to whatsapp_messages for review-link tracking
ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS therapy_session_id uuid,
ADD CONSTRAINT fk_whatsapp_messages_therapy_session
  FOREIGN KEY (therapy_session_id)
  REFERENCES public.therapy_sessions(id)
  ON DELETE SET NULL;

-- Extend the review trigger to also send the WhatsApp review link
CREATE OR REPLACE FUNCTION public.create_review_on_session_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_review public.therapy_session_reviews%ROWTYPE;
  v_url text := 'https://amipgrjksrszocfzucxn.supabase.co/functions/v1/send-appointment-whatsapp';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaXBncmprc3Jzem9jZnp1Y3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTI0NDIsImV4cCI6MjA5NjIyODQ0Mn0.-iFJ_US4PR9SBTyZyMetOtJ4N3nyvE0foeS-0BvSjBU';
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO public.therapy_session_reviews (
      clinic_id, session_id, therapist_id, patient_id
    ) VALUES (
      NEW.clinic_id, NEW.id, NEW.therapist_id, NEW.patient_id
    ) ON CONFLICT (session_id) DO NOTHING
    RETURNING * INTO v_review;

    -- If the row already existed, fetch it so we can send the link
    IF v_review.id IS NULL THEN
      SELECT * INTO v_review
      FROM public.therapy_session_reviews
      WHERE session_id = NEW.id
      LIMIT 1;
    END IF;

    -- Send review WhatsApp only once per session
    IF v_review.id IS NOT NULL
       AND NEW.patient_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.whatsapp_messages
         WHERE therapy_session_id = NEW.id
           AND event = 'review'
           AND status = 'sent'
       ) THEN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon
        ),
        body := jsonb_build_object(
          'therapy_session_id', NEW.id,
          'event', 'review'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Appointment reminder scheduler
CREATE OR REPLACE FUNCTION public.send_due_appointment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_url text := 'https://amipgrjksrszocfzucxn.supabase.co/functions/v1/send-appointment-whatsapp';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaXBncmprc3Jzem9jZnp1Y3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTI0NDIsImV4cCI6MjA5NjIyODQ0Mn0.-iFJ_US4PR9SBTyZyMetOtJ4N3nyvE0foeS-0BvSjBU';
  v_tz text := 'Asia/Kolkata';
  rec record;
BEGIN
  FOR rec IN
    SELECT a.id
    FROM public.appointments a
    WHERE a.status NOT IN ('cancelled', 'completed')
      AND a.patient_id IS NOT NULL
      AND a.appointment_date IS NOT NULL
      AND a.appointment_time IS NOT NULL
      AND (a.appointment_date + a.appointment_time)::timestamp without time zone
          BETWEEN (timezone(v_tz, now()) + interval '1 hour 45 minutes')::timestamp without time zone
              AND (timezone(v_tz, now()) + interval '2 hours 15 minutes')::timestamp without time zone
      AND NOT EXISTS (
        SELECT 1 FROM public.whatsapp_messages w
        WHERE w.appointment_id = a.id
          AND w.event = 'reminder'
          AND w.status = 'sent'
      )
  LOOP
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon
      ),
      body := jsonb_build_object(
        'appointment_id', rec.id,
        'event', 'reminder'
      )
    );
  END LOOP;
END;
$$;

-- Schedule the reminder job every 15 minutes
SELECT cron.schedule('appointment-reminders-15min', '*/15 * * * *', 'SELECT public.send_due_appointment_reminders();');

COMMIT;