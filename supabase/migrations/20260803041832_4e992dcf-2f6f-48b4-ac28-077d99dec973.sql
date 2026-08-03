CREATE OR REPLACE FUNCTION public.send_due_followup_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://amipgrjksrszocfzucxn.supabase.co/functions/v1/send-appointment-whatsapp';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaXBncmprc3Jzem9jZnp1Y3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTI0NDIsImV4cCI6MjA5NjIyODQ0Mn0.-iFJ_US4PR9SBTyZyMetOtJ4N3nyvE0foeS-0BvSjBU';
  v_tz text := 'Asia/Kolkata';
  v_target date;
  rec record;
BEGIN
  v_target := (timezone(v_tz, now()))::date - 7;

  FOR rec IN
    SELECT DISTINCT ON (a.patient_id) a.id, a.patient_id
    FROM public.appointments a
    WHERE a.appointment_date = v_target
      AND a.status = 'completed'
      AND a.patient_id IS NOT NULL
      -- no later (non-cancelled) appointment booked since that visit
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a2
        WHERE a2.patient_id = a.patient_id
          AND a2.id <> a.id
          AND a2.status <> 'cancelled'
          AND a2.appointment_date > v_target
      )
      -- not already messaged in the last 30 days
      AND NOT EXISTS (
        SELECT 1 FROM public.whatsapp_messages w
        WHERE w.patient_id = a.patient_id
          AND w.event = 'followup'
          AND w.status = 'sent'
          AND w.created_at > now() - interval '30 days'
      )
    ORDER BY a.patient_id, a.appointment_time DESC NULLS LAST
  LOOP
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon
      ),
      body := jsonb_build_object(
        'appointment_id', rec.id,
        'event', 'followup'
      )
    );
  END LOOP;
END;
$$;

SELECT cron.unschedule('send-followup-care-messages')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-followup-care-messages');

SELECT cron.schedule(
  'send-followup-care-messages',
  '30 4 * * *',
  $$SELECT public.send_due_followup_messages();$$
);