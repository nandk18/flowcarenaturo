CREATE OR REPLACE FUNCTION public.analytics_therapists(p_clinic_id uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT public._analytics_can_access(p_clinic_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  WITH sess AS (
    SELECT
      ts.therapist_id,
      COUNT(*) FILTER (WHERE ts.status='completed') AS completed,
      COUNT(*) FILTER (WHERE ts.status='cancelled') AS cancelled,
      COUNT(DISTINCT ts.patient_id) FILTER (WHERE ts.status='completed') AS unique_patients,
      ROUND(AVG(EXTRACT(EPOCH FROM (ts.completed_at - ts.started_at))/60)
            FILTER (WHERE ts.status='completed' AND ts.started_at IS NOT NULL AND ts.completed_at IS NOT NULL)::numeric, 1) AS avg_minutes
    FROM therapy_sessions ts
    WHERE ts.session_date BETWEEN p_from AND p_to
      AND (p_clinic_id IS NULL OR ts.clinic_id = p_clinic_id)
    GROUP BY ts.therapist_id
  ),
  rev AS (
    SELECT
      r.therapist_id,
      ROUND(AVG(r.rating) FILTER (WHERE r.submitted_at IS NOT NULL)::numeric, 2) AS avg_rating,
      COUNT(*) FILTER (WHERE r.submitted_at IS NOT NULL) AS reviews_count,
      COUNT(*) FILTER (WHERE r.sent_at IS NOT NULL) AS reviews_sent
    FROM therapy_session_reviews r
    WHERE r.created_at::date BETWEEN p_from AND p_to
      AND (p_clinic_id IS NULL OR r.clinic_id = p_clinic_id)
    GROUP BY r.therapist_id
  ),
  per AS (
    SELECT
      p.id, p.full_name, p.therapist_color,
      COALESCE(sess.completed, 0) AS completed,
      COALESCE(sess.cancelled, 0) AS cancelled,
      COALESCE(sess.unique_patients, 0) AS unique_patients,
      sess.avg_minutes,
      rev.avg_rating,
      COALESCE(rev.reviews_count, 0) AS reviews_count,
      COALESCE(rev.reviews_sent, 0) AS reviews_sent
    FROM profiles p
    LEFT JOIN sess ON sess.therapist_id = p.id
    LEFT JOIN rev  ON rev.therapist_id  = p.id
    WHERE p.is_therapist = true
      AND (p_clinic_id IS NULL OR p.clinic_id = p_clinic_id)
    ORDER BY completed DESC NULLS LAST
  )
  SELECT jsonb_build_object(
    'therapists', COALESCE((SELECT jsonb_agg(to_jsonb(pr)) FROM per pr),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $function$;