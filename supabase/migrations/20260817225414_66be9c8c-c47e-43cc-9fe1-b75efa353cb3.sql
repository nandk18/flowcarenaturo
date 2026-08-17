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
  )
  SELECT count(*),
         count(*) FILTER (WHERE lead_status = 'current' AND booked),
         coalesce(jsonb_agg(x ORDER BY (x->>'leads')::int DESC), '[]'::jsonb)
    INTO v_leads_range, v_conv_range, v_by_source
    FROM leads,
         LATERAL (SELECT 1) dummy,
         LATERAL (
           SELECT jsonb_build_object(
                    'source', s.src,
                    'leads', s.cnt,
                    'won', s.won,
                    'rate', CASE WHEN s.cnt > 0 THEN round(s.won::numeric * 100 / s.cnt, 1) ELSE 0 END
                  ) AS x
             FROM (SELECT src, count(*) AS cnt,
                          count(*) FILTER (WHERE lead_status = 'current' AND booked) AS won
                     FROM leads GROUP BY src) s
            WHERE s.src = leads.src
            LIMIT 1
         ) agg;

  SELECT coalesce(jsonb_agg(r ORDER BY (r->>'due') NULLS FIRST), '[]'::jsonb)
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
    'by_source', coalesce((SELECT jsonb_agg(DISTINCT e) FROM jsonb_array_elements(v_by_source) e), '[]'::jsonb),
    'pipeline', v_pipeline
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.analytics_leads(uuid, date, date) TO authenticated;