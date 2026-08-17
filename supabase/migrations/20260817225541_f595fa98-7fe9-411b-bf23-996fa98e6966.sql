CREATE OR REPLACE FUNCTION public.analytics_leads(p_clinic_id uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_new_today int := 0;
  v_in_progress int := 0;
  v_overdue int := 0;
  v_leads_range int := 0;
  v_conv_range int := 0;
  v_by_source jsonb := '[]'::jsonb;
  v_pipeline jsonb := '[]'::jsonb;
BEGIN
  IF NOT public._analytics_can_access(p_clinic_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT count(*) INTO v_new_today
    FROM public.patients
   WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
     AND lead_status IN ('attempt1','attempt2','attempt3')
     AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = v_today;

  SELECT count(*),
         count(*) FILTER (WHERE call_due_date IS NOT NULL AND call_due_date < v_today)
    INTO v_in_progress, v_overdue
    FROM public.patients
   WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
     AND lead_status IN ('attempt1','attempt2','attempt3');

  WITH leads AS (
    SELECT p.id,
           coalesce(nullif(trim(p.lead_source), ''), 'Unknown') AS src,
           p.lead_status,
           EXISTS (SELECT 1 FROM public.appointments a WHERE a.patient_id = p.id) AS booked
      FROM public.patients p
     WHERE (p_clinic_id IS NULL OR p.clinic_id = p_clinic_id)
       AND p.lead_status IS NOT NULL
       AND (p.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to
  ), grouped AS (
    SELECT src,
           count(*)::int AS cnt,
           count(*) FILTER (WHERE lead_status = 'current' AND booked)::int AS won
      FROM leads GROUP BY src
  )
  SELECT
    coalesce((SELECT sum(cnt) FROM grouped), 0),
    coalesce((SELECT sum(won) FROM grouped), 0),
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'source', src, 'leads', cnt, 'won', won,
               'rate', CASE WHEN cnt > 0 THEN round(won::numeric * 100 / cnt, 1) ELSE 0 END
             ) ORDER BY cnt DESC)
        FROM grouped
    ), '[]'::jsonb)
  INTO v_leads_range, v_conv_range, v_by_source;

  SELECT coalesce(jsonb_agg(r), '[]'::jsonb)
    INTO v_pipeline
    FROM (
      SELECT jsonb_build_object(
               'id', p.id,
               'name', p.name,
               'phone', p.phone,
               'status', p.lead_status,
               'source', p.lead_source,
               'due', p.call_due_date,
               'created_at', p.created_at,
               'overdue_days', CASE WHEN p.call_due_date IS NOT NULL AND p.call_due_date < v_today
                                    THEN v_today - p.call_due_date ELSE 0 END
             ) AS r
        FROM public.patients p
       WHERE (p_clinic_id IS NULL OR p.clinic_id = p_clinic_id)
         AND (
              p.lead_status IN ('attempt1','attempt2','attempt3')
              OR (p.lead_status IN ('closed','lapsed')
                  AND (p.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to)
             )
       ORDER BY p.call_due_date NULLS FIRST, p.created_at DESC
       LIMIT 200
    ) q;

  RETURN jsonb_build_object(
    'totals', jsonb_build_object(
      'new_today', v_new_today,
      'in_progress', v_in_progress,
      'overdue_attempts', v_overdue,
      'leads_in_range', v_leads_range,
      'converted_in_range', v_conv_range,
      'conversion_rate', CASE WHEN v_leads_range > 0
                              THEN round(v_conv_range::numeric * 100 / v_leads_range, 1) ELSE 0 END
    ),
    'by_source', v_by_source,
    'pipeline', v_pipeline
  );
END $function$;