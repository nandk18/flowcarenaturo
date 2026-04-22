DROP POLICY IF EXISTS "clinic_audit_logs_insert" ON public.audit_logs;

CREATE POLICY "clinic_audit_logs_insert" ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND clinic_id = public.get_user_clinic_id(auth.uid())
  );