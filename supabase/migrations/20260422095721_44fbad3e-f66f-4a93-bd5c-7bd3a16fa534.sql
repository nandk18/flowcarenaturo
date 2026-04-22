CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text,
  user_role text,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  resource_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_audit_logs_select" ON public.audit_logs
  FOR SELECT USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "clinic_audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "super_admin_audit_logs" ON public.audit_logs
  FOR ALL USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic ON public.audit_logs(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at DESC);