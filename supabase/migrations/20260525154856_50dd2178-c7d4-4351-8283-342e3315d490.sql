
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  invoice_date date DEFAULT CURRENT_DATE,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(10,2) DEFAULT 0,
  gst_percentage numeric(5,2) DEFAULT 0,
  gst_amount numeric(10,2) DEFAULT 0,
  discount_amount numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  paid_amount numeric(10,2) DEFAULT 0,
  outstanding_amount numeric(10,2) DEFAULT 0,
  status text DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','cancelled')),
  notes text,
  pdf_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash','upi','card','insurance','other')),
  payment_date date DEFAULT CURRENT_DATE,
  reference_number text,
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS gst_number text,
  ADD COLUMN IF NOT EXISTS gst_percentage numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS invoice_counter integer DEFAULT 1;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $func$
DECLARE
  v_prefix text;
  v_counter integer;
  v_year text;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT invoice_prefix, invoice_counter INTO v_prefix, v_counter
  FROM public.clinics WHERE id = NEW.clinic_id;
  NEW.invoice_number := COALESCE(v_prefix,'INV') || '-' || v_year || '-' || LPAD(COALESCE(v_counter,1)::text, 4, '0');
  UPDATE public.clinics SET invoice_counter = COALESCE(invoice_counter,1) + 1 WHERE id = NEW.clinic_id;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS set_invoice_number ON public.invoices;
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();

CREATE OR REPLACE FUNCTION public.update_invoice_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_updated_at();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_invoices_select" ON public.invoices
  FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_invoices_insert" ON public.invoices
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_invoices_update" ON public.invoices
  FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_invoices_delete" ON public.invoices
  FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'));
CREATE POLICY "public_invoice_view" ON public.invoices
  FOR SELECT USING (true);
CREATE POLICY "super_admin_invoices" ON public.invoices
  FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "clinic_payments_select" ON public.payments
  FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_payments_insert" ON public.payments
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "clinic_payments_delete" ON public.payments
  FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'));
CREATE POLICY "super_admin_payments" ON public.payments
  FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_invoices_clinic ON public.invoices(clinic_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON public.invoices(patient_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_visit ON public.invoices(visit_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_clinic ON public.payments(clinic_id, payment_date DESC);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
