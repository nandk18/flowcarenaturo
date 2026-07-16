
CREATE OR REPLACE FUNCTION public._analytics_can_access(p_clinic_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid; v_own uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RETURN false; END IF;
  IF public.is_super_admin(v_user) THEN RETURN true; END IF;
  IF p_clinic_id IS NULL THEN RETURN false; END IF;
  v_own := public.get_clinic_id_safe();
  RETURN v_own IS NOT NULL AND v_own = p_clinic_id;
END $$;

CREATE OR REPLACE FUNCTION public.analytics_revenue(p_clinic_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public._analytics_can_access(p_clinic_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  WITH inv AS (
    SELECT * FROM invoices
     WHERE invoice_date BETWEEN p_from AND p_to
       AND (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
  ),
  pay AS (
    SELECT * FROM payments
     WHERE payment_date BETWEEN p_from AND p_to
       AND (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
  ),
  daily AS (
    SELECT invoice_date::text AS d,
           SUM(total_amount)::numeric AS billed,
           SUM(paid_amount)::numeric AS collected
      FROM inv GROUP BY invoice_date ORDER BY invoice_date
  ),
  by_mode AS (
    SELECT COALESCE(payment_method,'unknown') AS mode, SUM(amount)::numeric AS amt, COUNT(*) AS cnt
      FROM pay GROUP BY payment_method
  ),
  by_service AS (
    SELECT li->>'name' AS service,
           SUM((li->>'total')::numeric) AS amt,
           COUNT(*) AS cnt
      FROM inv, LATERAL jsonb_array_elements(COALESCE(line_items,'[]'::jsonb)) li
     GROUP BY li->>'name' ORDER BY amt DESC NULLS LAST LIMIT 10
  ),
  aging AS (
    SELECT
      COALESCE(SUM(outstanding_amount) FILTER (WHERE (CURRENT_DATE - invoice_date) <= 7),0) AS b_0_7,
      COALESCE(SUM(outstanding_amount) FILTER (WHERE (CURRENT_DATE - invoice_date) BETWEEN 8 AND 30),0) AS b_8_30,
      COALESCE(SUM(outstanding_amount) FILTER (WHERE (CURRENT_DATE - invoice_date) > 30),0) AS b_31_plus
      FROM inv WHERE outstanding_amount > 0
  ),
  totals AS (
    SELECT
      COALESCE(SUM(subtotal),0)::numeric AS gross,
      COALESCE(SUM(discount_amount),0)::numeric AS discount,
      COALESCE(SUM(gst_amount),0)::numeric AS gst,
      COALESCE(SUM(total_amount),0)::numeric AS total_billed,
      COALESCE(SUM(paid_amount),0)::numeric AS total_collected,
      COALESCE(SUM(outstanding_amount),0)::numeric AS outstanding,
      COUNT(*) AS invoice_count,
      CASE WHEN COUNT(*)>0 THEN ROUND(AVG(total_amount),2) ELSE 0 END AS avg_invoice
      FROM inv
  ),
  expenses AS (
    SELECT COALESCE(SUM(amount),0)::numeric AS total_exp
      FROM expense_list
     WHERE expense_date BETWEEN p_from AND p_to
       AND (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
  )
  SELECT jsonb_build_object(
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'expenses', (SELECT to_jsonb(e) FROM expenses e),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily d),'[]'::jsonb),
    'by_mode', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM by_mode b),'[]'::jsonb),
    'by_service', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM by_service s),'[]'::jsonb),
    'aging', (SELECT to_jsonb(a) FROM aging a)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.analytics_patients(p_clinic_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public._analytics_can_access(p_clinic_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  WITH pts AS (
    SELECT * FROM patients WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
  ),
  new_in_range AS (
    SELECT COUNT(*)::int AS n FROM pts WHERE created_at::date BETWEEN p_from AND p_to
  ),
  totals AS (
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE lead_status='current')::int AS current_cnt,
           COUNT(*) FILTER (WHERE lead_status IN ('enquiry','attempt1','attempt2','attempt3'))::int AS leads,
           COUNT(*) FILTER (WHERE lead_status='dormant')::int AS dormant
      FROM pts
  ),
  gender AS (
    SELECT COALESCE(NULLIF(LOWER(gender),''),'unknown') AS g, COUNT(*) AS c FROM pts GROUP BY 1
  ),
  funnel AS (
    SELECT COALESCE(lead_status,'unknown') AS stage, COUNT(*) AS c FROM pts GROUP BY 1
  ),
  daily_new AS (
    SELECT created_at::date::text AS d, COUNT(*) AS c
      FROM pts WHERE created_at::date BETWEEN p_from AND p_to
      GROUP BY 1 ORDER BY 1
  ),
  ret_cte AS (
    SELECT COUNT(DISTINCT patient_id) AS c FROM appointments
     WHERE appointment_date BETWEEN p_from AND p_to
       AND (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
       AND patient_id IN (SELECT id FROM pts WHERE created_at::date < p_from)
  ),
  age_buckets AS (
    SELECT
      COUNT(*) FILTER (WHERE dob IS NOT NULL AND EXTRACT(YEAR FROM age(dob)) < 18) AS a_0_17,
      COUNT(*) FILTER (WHERE dob IS NOT NULL AND EXTRACT(YEAR FROM age(dob)) BETWEEN 18 AND 35) AS a_18_35,
      COUNT(*) FILTER (WHERE dob IS NOT NULL AND EXTRACT(YEAR FROM age(dob)) BETWEEN 36 AND 55) AS a_36_55,
      COUNT(*) FILTER (WHERE dob IS NOT NULL AND EXTRACT(YEAR FROM age(dob)) > 55) AS a_56_plus,
      COUNT(*) FILTER (WHERE dob IS NULL) AS a_unknown
      FROM pts
  )
  SELECT jsonb_build_object(
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'new_in_range', (SELECT n FROM new_in_range),
    'returning_in_range', (SELECT c FROM ret_cte),
    'gender', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM gender g),'[]'::jsonb),
    'funnel', COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM funnel f),'[]'::jsonb),
    'daily_new', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily_new d),'[]'::jsonb),
    'age_buckets', (SELECT to_jsonb(a) FROM age_buckets a)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.analytics_appointments(p_clinic_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public._analytics_can_access(p_clinic_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  WITH apps AS (
    SELECT * FROM appointments
     WHERE appointment_date BETWEEN p_from AND p_to
       AND (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
  ),
  totals AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='completed')::int AS completed,
      COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled,
      COUNT(*) FILTER (WHERE status='no_show')::int AS no_show,
      COUNT(*) FILTER (WHERE status IN ('scheduled','confirmed'))::int AS upcoming,
      COUNT(*) FILTER (WHERE rescheduled_from IS NOT NULL)::int AS rescheduled
      FROM apps
  ),
  daily AS (
    SELECT appointment_date::text AS d, COUNT(*) AS c FROM apps GROUP BY 1 ORDER BY 1
  ),
  by_doctor AS (
    SELECT COALESCE(d.name,'Unassigned') AS doctor,
           COUNT(a.*) AS total,
           COUNT(a.*) FILTER (WHERE a.status='completed') AS completed,
           COUNT(a.*) FILTER (WHERE a.status='cancelled') AS cancelled
      FROM apps a LEFT JOIN doctors d ON d.id = a.doctor_id
     GROUP BY d.name ORDER BY total DESC NULLS LAST LIMIT 15
  ),
  by_hour AS (
    SELECT EXTRACT(HOUR FROM appointment_time)::int AS h, COUNT(*) AS c
      FROM apps GROUP BY 1 ORDER BY 1
  ),
  by_dow AS (
    SELECT EXTRACT(DOW FROM appointment_date)::int AS dow, COUNT(*) AS c
      FROM apps GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily d),'[]'::jsonb),
    'by_doctor', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM by_doctor b),'[]'::jsonb),
    'by_hour', COALESCE((SELECT jsonb_agg(to_jsonb(h)) FROM by_hour h),'[]'::jsonb),
    'by_dow', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM by_dow d),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.analytics_treatments(p_clinic_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public._analytics_can_access(p_clinic_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  WITH ses AS (
    SELECT * FROM therapy_sessions
     WHERE session_date BETWEEN p_from AND p_to
       AND (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
  ),
  totals AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='completed')::int AS completed,
      COUNT(*) FILTER (WHERE status='in_progress')::int AS in_progress,
      COUNT(*) FILTER (WHERE status='not_started')::int AS not_started,
      COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled,
      COUNT(DISTINCT patient_id)::int AS unique_patients
      FROM ses
  ),
  daily AS (
    SELECT session_date::text AS d,
           COUNT(*) FILTER (WHERE status='completed') AS completed,
           COUNT(*) FILTER (WHERE status='cancelled') AS cancelled,
           COUNT(*) AS total
      FROM ses GROUP BY 1 ORDER BY 1
  ),
  by_service AS (
    SELECT service_name AS service,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status='completed') AS completed
      FROM ses GROUP BY 1 ORDER BY total DESC LIMIT 10
  ),
  plans AS (
    SELECT
      COUNT(*)::int AS total_plans,
      COUNT(*) FILTER (WHERE status='completed')::int AS completed_plans,
      COUNT(*) FILTER (WHERE status='active')::int AS active_plans
      FROM treatment_plans
     WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
       AND created_at::date BETWEEN p_from AND p_to
  ),
  adherence AS (
    SELECT
      COALESCE(SUM(sessions_completed),0)::int AS done,
      COALESCE(SUM(total_sessions),0)::int AS planned
      FROM treatment_plan_items
     WHERE (p_clinic_id IS NULL OR clinic_id = p_clinic_id)
       AND created_at::date BETWEEN p_from AND p_to
  )
  SELECT jsonb_build_object(
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily d),'[]'::jsonb),
    'by_service', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM by_service s),'[]'::jsonb),
    'plans', (SELECT to_jsonb(p) FROM plans p),
    'adherence', (SELECT to_jsonb(a) FROM adherence a)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.analytics_therapists(p_clinic_id uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public._analytics_can_access(p_clinic_id) THEN RAISE EXCEPTION 'Access denied'; END IF;
  WITH per AS (
    SELECT
      p.id, p.full_name, p.therapist_color,
      COUNT(ts.*) FILTER (WHERE ts.status='completed') AS completed,
      COUNT(ts.*) FILTER (WHERE ts.status='cancelled') AS cancelled,
      COUNT(DISTINCT ts.patient_id) FILTER (WHERE ts.status='completed') AS unique_patients,
      ROUND(AVG(EXTRACT(EPOCH FROM (ts.completed_at - ts.started_at))/60)
            FILTER (WHERE ts.status='completed' AND ts.started_at IS NOT NULL AND ts.completed_at IS NOT NULL)::numeric, 1) AS avg_minutes,
      ROUND(AVG(r.rating) FILTER (WHERE r.submitted_at IS NOT NULL)::numeric, 2) AS avg_rating,
      COUNT(r.*) FILTER (WHERE r.submitted_at IS NOT NULL) AS reviews_count,
      COUNT(r.*) FILTER (WHERE r.sent_at IS NOT NULL) AS reviews_sent
      FROM profiles p
      LEFT JOIN therapy_sessions ts ON ts.therapist_id = p.id
        AND ts.session_date BETWEEN p_from AND p_to
        AND (p_clinic_id IS NULL OR ts.clinic_id = p_clinic_id)
      LEFT JOIN therapy_session_reviews r ON r.therapist_id = p.id
        AND r.created_at::date BETWEEN p_from AND p_to
        AND (p_clinic_id IS NULL OR r.clinic_id = p_clinic_id)
     WHERE p.is_therapist = true
       AND (p_clinic_id IS NULL OR p.clinic_id = p_clinic_id)
     GROUP BY p.id, p.full_name, p.therapist_color
     ORDER BY completed DESC NULLS LAST
  )
  SELECT jsonb_build_object(
    'therapists', COALESCE((SELECT jsonb_agg(to_jsonb(pr)) FROM per pr),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.analytics_platform_overview(p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Super admin required'; END IF;
  WITH clinic_rows AS (
    SELECT
      c.id, c.name, c.created_at,
      (SELECT COUNT(*) FROM patients p WHERE p.clinic_id = c.id) AS patients,
      (SELECT COUNT(*) FROM appointments a WHERE a.clinic_id = c.id AND a.appointment_date BETWEEN p_from AND p_to) AS appointments,
      (SELECT COUNT(*) FROM therapy_sessions ts WHERE ts.clinic_id = c.id AND ts.session_date BETWEEN p_from AND p_to AND ts.status='completed') AS sessions_done,
      (SELECT COALESCE(SUM(total_amount),0) FROM invoices i WHERE i.clinic_id = c.id AND i.invoice_date BETWEEN p_from AND p_to) AS revenue_billed,
      (SELECT COALESCE(SUM(paid_amount),0) FROM invoices i WHERE i.clinic_id = c.id AND i.invoice_date BETWEEN p_from AND p_to) AS revenue_collected,
      (SELECT ROUND(AVG(rating)::numeric,2) FROM therapy_session_reviews r WHERE r.clinic_id = c.id AND r.submitted_at IS NOT NULL AND r.submitted_at::date BETWEEN p_from AND p_to) AS avg_rating,
      GREATEST(
         COALESCE((SELECT MAX(created_at) FROM appointments WHERE clinic_id=c.id),'1970-01-01'::timestamptz),
         COALESCE((SELECT MAX(created_at) FROM therapy_sessions WHERE clinic_id=c.id),'1970-01-01'::timestamptz),
         COALESCE((SELECT MAX(created_at) FROM invoices WHERE clinic_id=c.id),'1970-01-01'::timestamptz)
      ) AS last_activity
    FROM clinics c
  ),
  totals AS (
    SELECT
      COUNT(*)::int AS clinics_total,
      COUNT(*) FILTER (WHERE last_activity > (now() - interval '30 days'))::int AS clinics_active_30d,
      COALESCE(SUM(patients),0)::bigint AS patients_total,
      COALESCE(SUM(appointments),0)::bigint AS appointments_range,
      COALESCE(SUM(sessions_done),0)::bigint AS sessions_range,
      COALESCE(SUM(revenue_billed),0)::numeric AS revenue_billed,
      COALESCE(SUM(revenue_collected),0)::numeric AS revenue_collected
      FROM clinic_rows
  ),
  monthly AS (
    SELECT to_char(date_trunc('month', invoice_date),'YYYY-MM') AS m,
           SUM(total_amount)::numeric AS billed,
           SUM(paid_amount)::numeric AS collected
      FROM invoices
     WHERE invoice_date BETWEEN p_from AND p_to
     GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'clinics', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY revenue_billed DESC NULLS LAST) FROM clinic_rows c),'[]'::jsonb),
    'monthly', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM monthly m),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION public.analytics_revenue(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_patients(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_appointments(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_treatments(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_therapists(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_platform_overview(date,date) TO authenticated;
