CREATE TABLE public.clinic_whatsapp_settings (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'default',
  from_number text,
  account_sid text,
  auth_token_encrypted text,
  template_booked text,
  template_rescheduled text,
  template_cancelled text,
  template_reminder text,
  template_review text,
  template_followup text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_whatsapp_settings TO authenticated;
GRANT ALL ON public.clinic_whatsapp_settings TO service_role;

ALTER TABLE public.clinic_whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic staff manage own whatsapp settings"
ON public.clinic_whatsapp_settings
FOR ALL
TO authenticated
USING (
  clinic_id = public.get_user_clinic_id_fast()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'))
)
WITH CHECK (
  clinic_id = public.get_user_clinic_id_fast()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'))
);

CREATE POLICY "super admin manages all whatsapp settings"
ON public.clinic_whatsapp_settings
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER clinic_whatsapp_settings_updated_at
BEFORE UPDATE ON public.clinic_whatsapp_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS sender_mode text,
  ADD COLUMN IF NOT EXISTS from_number text;

ALTER TABLE public.clinic_whatsapp_settings
  ADD CONSTRAINT clinic_whatsapp_settings_mode_check
  CHECK (mode IN ('default', 'own_number', 'own_account'));