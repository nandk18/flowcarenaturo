CREATE OR REPLACE FUNCTION public.send_due_followup_messages()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url text := 'https://amipgrjksrszocfzucxn.supabase.co/functions/v1/send-appointment-whatsapp';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaXBncmprc3Jzem9jZnp1Y3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTI0NDIsImV4cCI6MjA5NjIyODQ0Mn0.-iFJ_US4PR9SBTyZyMetOtJ4N3nyvE0foeS-0BvSjBU';
  v_tz text := 'Asia/Kolkata';
  v_today date;
  rec record;
BEGIN
  v_today := (timezone(v_tz, now()))::date;

  FOR rec IN
    WITH last_visit AS (
      SELECT DISTINCT ON (a.patient_id)
             a.id, a.patient_id, a.appointment_date
        FROM public.appointments a
       WHERE a.status = 'completed'
         AND a.patient_id IS NOT NULL
         AND a.appointment_date BETWEEN v_today - 90 AND v_today
       ORDER BY a.patient_id, a.appointment_date DESC, a.appointment_time DESC NULLS LAST
    ),
    eligible AS (
      SELECT lv.id,
             lv.patient_id,
             (v_today - lv.appointment_date) AS days_since,
             (SELECT COUNT(*) FROM public.whatsapp_messages w
               WHERE w.patient_id = lv.patient_id
                 AND w.event = 'followup'
                 AND w.status = 'sent'
                 AND w.created_at::date >= lv.appointment_date) AS sent_count,
             (SELECT MAX(w.created_at) FROM public.whatsapp_messages w
               WHERE w.patient_id = lv.patient_id
                 AND w.event = 'followup'
                 AND w.status = 'sent'
                 AND w.created_at::date >= lv.appointment_date) AS last_sent_at,
             (SELECT COUNT(*) FROM public.whatsapp_messages w
               WHERE w.patient_id = lv.patient_id
                 AND w.event = 'followup'
                 AND w.created_at > now() - interval '20 hours') AS recent_count
        FROM last_visit lv
       WHERE NOT EXISTS (
         SELECT 1 FROM public.appointments a2
          WHERE a2.patient_id = lv.patient_id
            AND a2.id <> lv.id
            AND a2.status <> 'cancelled'
            AND a2.appointment_date > lv.appointment_date
       )
    )
    SELECT e.*,
           (timezone(v_tz, e.last_sent_at))::date AS last_sent_date
      FROM eligible e
  LOOP
    IF rec.recent_count > 0 THEN
      CONTINUE;
    END IF;

    IF rec.sent_count = 0 AND rec.days_since >= 10 THEN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon),
        body := jsonb_build_object('appointment_id', rec.id, 'event', 'followup', 'stage', 1)
      );

    ELSIF rec.sent_count = 1 AND (v_today - rec.last_sent_date) >= 5 THEN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon),
        body := jsonb_build_object('appointment_id', rec.id, 'event', 'followup', 'stage', 2)
      );

    ELSIF rec.sent_count = 2 AND (v_today - rec.last_sent_date) >= 3 THEN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon),
        body := jsonb_build_object('appointment_id', rec.id, 'event', 'followup', 'stage', 3)
      );

    -- All three sent and still no return booking -> mark the lead as lapsed
    ELSIF rec.sent_count >= 3 AND (v_today - rec.last_sent_date) >= 3 THEN
      UPDATE public.patients
         SET lead_status = 'lapsed'
       WHERE id = rec.patient_id
         AND COALESCE(lead_status, '') NOT IN ('lapsed', 'current');
    END IF;
  END LOOP;
END;
$function$;