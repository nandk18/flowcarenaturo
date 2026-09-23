CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.crypto_keys (
  name text PRIMARY KEY,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.crypto_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.crypto_keys FROM PUBLIC, anon, authenticated;

INSERT INTO private.crypto_keys (name, key)
SELECT 'patient_pii', encode(extensions.gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM private.crypto_keys WHERE name = 'patient_pii');

CREATE OR REPLACE FUNCTION public.pii_encrypt(p_value text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'extensions', 'public', 'private' AS $$
DECLARE k text;
BEGIN
  IF p_value IS NULL OR p_value = '' THEN RETURN p_value; END IF;
  IF p_value LIKE 'enc:v1:%' THEN RETURN p_value; END IF;
  SELECT key INTO k FROM private.crypto_keys WHERE name = 'patient_pii';
  RETURN 'enc:v1:' || encode(pgp_sym_encrypt(p_value, k), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.pii_decrypt(p_value text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'extensions', 'public', 'private' AS $$
DECLARE k text;
BEGIN
  IF p_value IS NULL OR p_value NOT LIKE 'enc:v1:%' THEN RETURN p_value; END IF;
  SELECT key INTO k FROM private.crypto_keys WHERE name = 'patient_pii';
  RETURN pgp_sym_decrypt(decode(substring(p_value from 8), 'base64'), k);
EXCEPTION WHEN others THEN RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pii_encrypt(text), public.pii_decrypt(text) TO anon, authenticated, service_role;

ALTER TABLE public.patients RENAME TO patients_secure;

CREATE OR REPLACE FUNCTION public.encrypt_patient_pii()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.medication_history := public.pii_encrypt(NEW.medication_history);
  NEW.past_surgery_details := public.pii_encrypt(NEW.past_surgery_details);
  NEW.emergency_contact_phone := public.pii_encrypt(NEW.emergency_contact_phone);
  RETURN NEW;
END;
$$;

CREATE TRIGGER aaa_encrypt_patient_pii
  BEFORE INSERT OR UPDATE ON public.patients_secure
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_patient_pii();

UPDATE public.patients_secure
SET medication_history = public.pii_encrypt(medication_history)
WHERE medication_history IS NOT NULL AND medication_history NOT LIKE 'enc:v1:%';

CREATE VIEW public.patients WITH (security_invoker = true) AS
SELECT
  id, clinic_id, name, first_name, last_name, healthcare_id, dob, gender, phone, email,
  blood_group, allergies, chronic_conditions, created_at, lead_status, call_due_date,
  sla_breach_days, lead_source, assigned_to, address, emergency_contact_name,
  public.pii_decrypt(emergency_contact_phone) AS emergency_contact_phone,
  emergency_contact_relation, convenient_time, food_habits, smoking, alcohol,
  sleep_hours, dinner_time,
  public.pii_decrypt(medication_history) AS medication_history,
  public.pii_decrypt(past_surgery_details) AS past_surgery_details
FROM public.patients_secure;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO anon, authenticated;
GRANT ALL ON public.patients TO service_role;

CREATE OR REPLACE FUNCTION public.patients_view_ins()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE r public.patients%ROWTYPE; v_id uuid;
BEGIN
  INSERT INTO public.patients_secure (
    id, clinic_id, name, first_name, last_name, healthcare_id, dob, gender, phone, email,
    blood_group, allergies, chronic_conditions, created_at, lead_status, call_due_date,
    sla_breach_days, lead_source, assigned_to, address, emergency_contact_name,
    emergency_contact_phone, emergency_contact_relation, convenient_time, food_habits,
    smoking, alcohol, sleep_hours, dinner_time, medication_history, past_surgery_details
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()), NEW.clinic_id, NEW.name, NEW.first_name, NEW.last_name,
    NEW.healthcare_id, NEW.dob, NEW.gender, NEW.phone, NEW.email, NEW.blood_group,
    COALESCE(NEW.allergies, '[]'::jsonb), COALESCE(NEW.chronic_conditions, '[]'::jsonb),
    COALESCE(NEW.created_at, now()), COALESCE(NEW.lead_status, 'attempt1'),
    COALESCE(NEW.call_due_date, CURRENT_DATE), COALESCE(NEW.sla_breach_days, 0),
    NEW.lead_source, NEW.assigned_to, NEW.address, NEW.emergency_contact_name,
    NEW.emergency_contact_phone, NEW.emergency_contact_relation, NEW.convenient_time,
    NEW.food_habits, NEW.smoking, NEW.alcohol, NEW.sleep_hours, NEW.dinner_time,
    NEW.medication_history, NEW.past_surgery_details
  ) RETURNING id INTO v_id;
  SELECT * INTO r FROM public.patients WHERE id = v_id;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.patients_view_upd()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE r public.patients%ROWTYPE;
BEGIN
  UPDATE public.patients_secure SET
    clinic_id = NEW.clinic_id, name = NEW.name, first_name = NEW.first_name,
    last_name = NEW.last_name, healthcare_id = NEW.healthcare_id, dob = NEW.dob,
    gender = NEW.gender, phone = NEW.phone, email = NEW.email, blood_group = NEW.blood_group,
    allergies = NEW.allergies, chronic_conditions = NEW.chronic_conditions,
    created_at = NEW.created_at, lead_status = NEW.lead_status,
    call_due_date = NEW.call_due_date, sla_breach_days = NEW.sla_breach_days,
    lead_source = NEW.lead_source, assigned_to = NEW.assigned_to, address = NEW.address,
    emergency_contact_name = NEW.emergency_contact_name,
    emergency_contact_phone = NEW.emergency_contact_phone,
    emergency_contact_relation = NEW.emergency_contact_relation,
    convenient_time = NEW.convenient_time, food_habits = NEW.food_habits,
    smoking = NEW.smoking, alcohol = NEW.alcohol, sleep_hours = NEW.sleep_hours,
    dinner_time = NEW.dinner_time, medication_history = NEW.medication_history,
    past_surgery_details = NEW.past_surgery_details
  WHERE id = OLD.id;
  SELECT * INTO r FROM public.patients WHERE id = OLD.id;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.patients_view_del()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.patients_secure WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER patients_view_ins INSTEAD OF INSERT ON public.patients FOR EACH ROW EXECUTE FUNCTION public.patients_view_ins();
CREATE TRIGGER patients_view_upd INSTEAD OF UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.patients_view_upd();
CREATE TRIGGER patients_view_del INSTEAD OF DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.patients_view_del();