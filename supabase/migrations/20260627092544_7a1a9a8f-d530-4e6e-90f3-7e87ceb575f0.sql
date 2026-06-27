
-- Storage policies for invoice-pdfs bucket: clinic staff manage their clinic's invoice PDFs
CREATE POLICY "Clinic staff read invoice pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'invoice-pdfs' AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text);

CREATE POLICY "Clinic staff upload invoice pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoice-pdfs' AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text);

CREATE POLICY "Clinic staff update invoice pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'invoice-pdfs' AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text);

CREATE POLICY "Clinic staff delete invoice pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoice-pdfs' AND (storage.foldername(name))[1] = public.get_user_clinic_id(auth.uid())::text);

-- Petty cash adjust RPC (atomic balance update)
CREATE OR REPLACE FUNCTION public.adjust_petty_cash(p_clinic_id uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  INSERT INTO public.clinic_financial_settings (clinic_id, petty_cash_balance, petty_cash_limit)
  VALUES (p_clinic_id, 0, 0)
  ON CONFLICT (clinic_id) DO NOTHING;

  UPDATE public.clinic_financial_settings
  SET petty_cash_balance = COALESCE(petty_cash_balance, 0) + p_delta,
      updated_at = now()
  WHERE clinic_id = p_clinic_id
  RETURNING petty_cash_balance INTO v_balance;

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_petty_cash(uuid, numeric) TO authenticated;
