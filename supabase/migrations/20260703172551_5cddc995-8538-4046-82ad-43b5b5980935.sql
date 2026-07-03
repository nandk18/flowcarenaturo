-- 1. pg_net for HTTP from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Grants on push_subscriptions so therapists can register/unregister their own device
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

CREATE POLICY "therapist reads own subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (clinic_id = public.get_clinic_id_safe());

CREATE POLICY "therapist inserts subscription in clinic"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.get_clinic_id_safe());

CREATE POLICY "therapist updates own subscription"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (clinic_id = public.get_clinic_id_safe())
  WITH CHECK (clinic_id = public.get_clinic_id_safe());

CREATE POLICY "therapist deletes own subscription"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (clinic_id = public.get_clinic_id_safe());

-- Unique on endpoint so upsert works
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key ON public.push_subscriptions(endpoint);

-- 3. Trigger: on new session or therapist change, call edge function
CREATE OR REPLACE FUNCTION public.notify_therapist_session_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text := 'https://amipgrjksrszocfzucxn.supabase.co/functions/v1/send-therapist-push';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaXBncmprc3Jzem9jZnp1Y3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTI0NDIsImV4cCI6MjA5NjIyODQ0Mn0.-iFJ_US4PR9SBTyZyMetOtJ4N3nyvE0foeS-0BvSjBU';
  v_kind text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'not_started' AND NEW.session_date = CURRENT_DATE THEN
      v_kind := CASE WHEN NEW.therapist_id IS NOT NULL THEN 'assigned' ELSE 'available' END;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.therapist_id IS DISTINCT FROM OLD.therapist_id
       AND NEW.therapist_id IS NOT NULL
       AND NEW.session_date = CURRENT_DATE
       AND NEW.status IN ('not_started','in_progress') THEN
      v_kind := 'assigned';
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  PERFORM extensions.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||v_anon
    ),
    body := jsonb_build_object(
      'kind', v_kind,
      'session_id', NEW.id,
      'clinic_id', NEW.clinic_id,
      'therapist_id', NEW.therapist_id,
      'service_name', NEW.service_name,
      'room', NEW.room,
      'patient_id', NEW.patient_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_therapist_session ON public.therapy_sessions;
CREATE TRIGGER trg_notify_therapist_session
AFTER INSERT OR UPDATE OF therapist_id, status ON public.therapy_sessions
FOR EACH ROW EXECUTE FUNCTION public.notify_therapist_session_change();