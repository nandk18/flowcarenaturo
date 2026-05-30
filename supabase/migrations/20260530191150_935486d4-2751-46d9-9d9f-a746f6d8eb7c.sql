DROP TRIGGER IF EXISTS set_invoice_number ON public.invoices;
DROP FUNCTION IF EXISTS public.generate_invoice_number();

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $func$
DECLARE
  v_prefix text;
  v_counter integer;
  v_year text;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  v_prefix := (SELECT COALESCE(invoice_prefix, 'INV') FROM public.clinics WHERE id = NEW.clinic_id);
  v_counter := (SELECT COALESCE(invoice_counter, 1) FROM public.clinics WHERE id = NEW.clinic_id);

  NEW.invoice_number := v_prefix || '-' || v_year || '-' || LPAD(v_counter::text, 4, '0');

  UPDATE public.clinics SET invoice_counter = COALESCE(invoice_counter, 1) + 1 WHERE id = NEW.clinic_id;

  RETURN NEW;
END;
$func$;

CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_invoice_number();

DROP POLICY IF EXISTS "public_invoice_view" ON public.invoices;
CREATE POLICY "public_invoice_view" ON public.invoices
  FOR SELECT
  USING (true);

GRANT SELECT ON public.invoices TO anon;