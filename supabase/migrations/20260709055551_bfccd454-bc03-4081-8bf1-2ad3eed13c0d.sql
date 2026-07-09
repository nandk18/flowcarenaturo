
-- 1) Table
CREATE TABLE public.therapy_session_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  session_id uuid NOT NULL UNIQUE REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
  therapist_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  rating smallint,
  sent_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tsr_rating_range CHECK (rating IS NULL OR (rating BETWEEN 0 AND 5))
);
CREATE INDEX idx_tsr_clinic_therapist ON public.therapy_session_reviews(clinic_id, therapist_id);
CREATE INDEX idx_tsr_submitted ON public.therapy_session_reviews(submitted_at);

GRANT SELECT ON public.therapy_session_reviews TO anon;
GRANT SELECT, UPDATE ON public.therapy_session_reviews TO authenticated;
GRANT ALL ON public.therapy_session_reviews TO service_role;

ALTER TABLE public.therapy_session_reviews ENABLE ROW LEVEL SECURITY;

-- anon: no direct access; use RPCs. Deny all.
CREATE POLICY "clinic staff read reviews"
  ON public.therapy_session_reviews FOR SELECT TO authenticated
  USING (clinic_id = public.get_clinic_id_safe());

CREATE POLICY "clinic staff update reviews"
  ON public.therapy_session_reviews FOR UPDATE TO authenticated
  USING (clinic_id = public.get_clinic_id_safe())
  WITH CHECK (clinic_id = public.get_clinic_id_safe());

-- updated_at trigger
CREATE TRIGGER trg_tsr_updated_at
  BEFORE UPDATE ON public.therapy_session_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Auto-create review row when a session becomes completed
CREATE OR REPLACE FUNCTION public.create_review_on_session_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO public.therapy_session_reviews (
      clinic_id, session_id, therapist_id, patient_id
    ) VALUES (
      NEW.clinic_id, NEW.id, NEW.therapist_id, NEW.patient_id
    ) ON CONFLICT (session_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_review_on_complete
  AFTER INSERT OR UPDATE OF status ON public.therapy_sessions
  FOR EACH ROW EXECUTE FUNCTION public.create_review_on_session_complete();

-- Backfill for already-completed sessions
INSERT INTO public.therapy_session_reviews (clinic_id, session_id, therapist_id, patient_id)
SELECT clinic_id, id, therapist_id, patient_id
  FROM public.therapy_sessions
 WHERE status = 'completed'
ON CONFLICT (session_id) DO NOTHING;

-- 3) Public: fetch context for a review link
CREATE OR REPLACE FUNCTION public.get_review_context(p_token uuid)
RETURNS TABLE(
  therapist_name text,
  service_name text,
  clinic_name text,
  patient_name text,
  session_date date,
  already_submitted boolean,
  rating smallint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(p.full_name, 'Therapist') AS therapist_name,
    ts.service_name,
    c.name AS clinic_name,
    TRIM(COALESCE(pt.first_name,'') || ' ' || COALESCE(pt.last_name,'')) AS patient_name,
    ts.session_date,
    (r.submitted_at IS NOT NULL) AS already_submitted,
    r.rating
  FROM public.therapy_session_reviews r
  JOIN public.therapy_sessions ts ON ts.id = r.session_id
  JOIN public.clinics c ON c.id = r.clinic_id
  JOIN public.patients pt ON pt.id = r.patient_id
  LEFT JOIN public.profiles p ON p.id = r.therapist_id
  WHERE r.token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.get_review_context(uuid) TO anon, authenticated;

-- 4) Public: submit rating (0-5), once
CREATE OR REPLACE FUNCTION public.submit_therapy_review(p_token uuid, p_rating int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review therapy_session_reviews%ROWTYPE;
BEGIN
  IF p_rating IS NULL OR p_rating < 0 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rating must be between 0 and 5');
  END IF;
  SELECT * INTO v_review FROM public.therapy_session_reviews WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid link');
  END IF;
  IF v_review.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Review already submitted', 'rating', v_review.rating);
  END IF;
  UPDATE public.therapy_session_reviews
     SET rating = p_rating,
         submitted_at = now(),
         updated_at = now()
   WHERE token = p_token;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_therapy_review(uuid, int) TO anon, authenticated;

-- 5) Mark review as sent (records timestamp) — clinic-scoped
CREATE OR REPLACE FUNCTION public.mark_review_sent(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.therapy_session_reviews
     SET sent_at = COALESCE(sent_at, now()),
         updated_at = now()
   WHERE token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_review_sent(uuid) TO authenticated;

-- 6) Scorecards RPC
CREATE OR REPLACE FUNCTION public.get_therapist_scorecards(p_clinic_id uuid)
RETURNS TABLE(
  therapist_id uuid,
  therapist_name text,
  therapist_color text,
  reviews_30d bigint,
  avg_30d numeric,
  reviews_lifetime bigint,
  avg_lifetime numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS therapist_id,
    p.full_name AS therapist_name,
    p.therapist_color,
    COUNT(r.id) FILTER (WHERE r.submitted_at >= now() - interval '30 days') AS reviews_30d,
    ROUND(AVG(r.rating) FILTER (WHERE r.submitted_at >= now() - interval '30 days')::numeric, 2) AS avg_30d,
    COUNT(r.id) FILTER (WHERE r.submitted_at IS NOT NULL) AS reviews_lifetime,
    ROUND(AVG(r.rating) FILTER (WHERE r.submitted_at IS NOT NULL)::numeric, 2) AS avg_lifetime
  FROM public.profiles p
  LEFT JOIN public.therapy_session_reviews r
    ON r.therapist_id = p.id AND r.clinic_id = p_clinic_id
  WHERE p.clinic_id = p_clinic_id AND p.is_therapist = true
  GROUP BY p.id, p.full_name, p.therapist_color
  ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_therapist_scorecards(uuid) TO authenticated;

-- 7) Seed template for existing clinics
INSERT INTO public.message_templates (clinic_id, type, name, message_body, is_active)
SELECT c.id, 'therapy_review_request', 'Therapy Review Request',
  'Hi {patient_name}, thank you for visiting {clinic_name}! Please take a moment to rate your session ({service_name}) with {therapist_name}: {review_link}',
  true
FROM public.clinics c
ON CONFLICT (clinic_id, type) DO NOTHING;

-- Update seeder for new clinics
CREATE OR REPLACE FUNCTION public.seed_default_message_templates(p_clinic_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO message_templates (clinic_id, type, name, message_body) VALUES
    (p_clinic_id, 'attempt1_reminder', 'Attempt 1 Call',
     'Hi {patient_name}, this is {clinic_name}. We noticed you recently enquired with us. We would love to help you on your health journey. Please call us at your convenience or reply to this message.'),
    (p_clinic_id, 'attempt2_reminder', 'Attempt 2 Call',
     'Hi {patient_name}, we tried reaching you earlier from {clinic_name}. We are here to help with your health needs. Please give us a call or let us know a good time to connect.'),
    (p_clinic_id, 'appointment_reminder', 'Appointment Reminder',
     'Hi {patient_name}, this is a reminder of your appointment tomorrow at {appointment_time} with {doctor_name} at {clinic_name}. Please reply to confirm or call us to reschedule.'),
    (p_clinic_id, 'patient_form_link', 'Patient Form Link',
     'Hi {patient_name}, welcome to {clinic_name}! Please take a moment to fill in your patient details using this link: {form_link}. This helps us serve you better. Link valid for 7 days.'),
    (p_clinic_id, 'appointment_confirmation', 'Appointment Confirmation',
     'Hi {patient_name}, your appointment at {clinic_name} is confirmed for {appointment_date} at {appointment_time} with {doctor_name}. See you soon!'),
    (p_clinic_id, 'invoice_payment', 'Invoice / Payment',
     'Hi {patient_name}, please find your invoice from {clinic_name}. Invoice No: {invoice_number} | Date: {invoice_date} | Total: {invoice_amount}. View here: {invoice_link}. Thank you!'),
    (p_clinic_id, 'care_call', 'Care Call',
     'Hi {patient_name}, this is {clinic_name}. We hope you are feeling well after your recent visit. We are checking in to see how you are doing. Please feel free to reach out if you need anything or would like to schedule a follow-up appointment.'),
    (p_clinic_id, 'appointment_cancelled_notice', 'Appointment Cancellation',
     'Hi {patient_name}, we regret to inform you that your appointment at {clinic_name} on {appointment_date} at {appointment_time} has been cancelled due to {reason}. Please contact us to reschedule at your earliest convenience.'),
    (p_clinic_id, 'therapy_session_reminder', 'Therapy Session Reminder',
     'Hi {patient_name}, this is a reminder for your therapy session ({service_name}) tomorrow at {clinic_name}. Please arrive 10 minutes early. Reply to confirm or reschedule.'),
    (p_clinic_id, 'therapy_review_request', 'Therapy Review Request',
     'Hi {patient_name}, thank you for visiting {clinic_name}! Please take a moment to rate your session ({service_name}) with {therapist_name}: {review_link}')
  ON CONFLICT (clinic_id, type) DO NOTHING;
END;
$function$;
