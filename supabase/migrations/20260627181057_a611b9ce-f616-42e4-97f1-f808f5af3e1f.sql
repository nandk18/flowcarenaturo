ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS invoice_header_note text,
  ADD COLUMN IF NOT EXISTS invoice_footer_note text,
  ADD COLUMN IF NOT EXISTS show_logo_on_invoice boolean NOT NULL DEFAULT true;