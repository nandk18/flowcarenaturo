CREATE OR REPLACE FUNCTION public.patient_list_metrics(
  p_clinic_id uuid,
  p_status text DEFAULT 'all',
  p_source text DEFAULT 'all',
  p_search text DEFAULT '',
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_counts jsonb;
  v_filtered_count bigint;
  v_search text := btrim(COALESCE(p_search, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.get_user_clinic_id(auth.uid()) = p_clinic_id
    OR public.is_super_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized for this clinic';
  END IF;

  SELECT jsonb_build_object(
    'all', count(*),
    'attempt1', count(*) FILTER (WHERE lead_status = 'attempt1'),
    'attempt2', count(*) FILTER (WHERE lead_status = 'attempt2'),
    'attempt3', count(*) FILTER (WHERE lead_status = 'attempt3'),
    'closed', count(*) FILTER (WHERE lead_status = 'closed'),
    'lapsed', count(*) FILTER (WHERE lead_status = 'lapsed'),
    'current', count(*) FILTER (WHERE lead_status = 'current')
  )
  INTO v_counts
  FROM public.patients
  WHERE clinic_id = p_clinic_id;

  SELECT count(*)
  INTO v_filtered_count
  FROM public.patients
  WHERE clinic_id = p_clinic_id
    AND (p_status = 'all' OR lead_status = p_status)
    AND (p_source = 'all' OR lead_source = p_source)
    AND (p_from IS NULL OR created_at >= p_from)
    AND (p_to IS NULL OR created_at <= p_to)
    AND (
      v_search = ''
      OR name ILIKE '%' || v_search || '%'
      OR phone ILIKE '%' || v_search || '%'
      OR email ILIKE '%' || v_search || '%'
    );

  RETURN jsonb_build_object(
    'status_counts', COALESCE(v_counts, '{}'::jsonb),
    'filtered_count', v_filtered_count
  );
END;
$$;