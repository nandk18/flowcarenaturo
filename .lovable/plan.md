# Plan: Refocus Settings → Billing Config

## Goal

- Per-invoice creation / payment / sharing lives **only** in the patient's Invoices tab (already implemented there).
- `/settings/billing-config` becomes **Invoice Analytics + Invoice Configuration** (GST details, invoice header/footer, numbering).
- Move the GST/Invoice fields out of "Clinic Profile" in Settings into this new combined page.

## Changes

### 1. New page `src/pages/BillingConfigPage.tsx`

Two tabs inside one `SettingsShell`:

**Tab A — Analytics** (read-only dashboard, no per-invoice actions)
- Summary cards: Today's Collection, Outstanding, Invoices Today, Paid Today
- Date-range filter (From / To)
- Daily Collection line chart (last 30 days)
- Payment Method breakdown
- Outstanding Patients list — each row links to `/patients/:id?tab=invoices`
- Totals row: Total Invoiced, Total Collected, Outstanding, Collection Rate
- Export CSV (analytics summary only)
- Realtime subscription on `invoices` + `payments` preserved
- **Removed:** Create Invoice button, per-invoice list with View / Record Payment / Share buttons, status filter tabs

**Tab B — Invoice Configuration** (admin-only form)
- GST Number (GSTIN, 15 char)
- GST % default (0 / 5 / 12 / 18)
- Invoice Number Prefix (preview: `PREFIX-YYYY-0001`)
- **NEW:** Invoice Header Note (multi-line, shown under clinic info on PDF/print)
- **NEW:** Invoice Footer Note (multi-line, shown above "Thank you for visiting")
- **NEW:** Show clinic logo on invoice (toggle, defaults true)
- Save button → updates `clinics` row, invalidates `useClinic` cache

### 2. `src/pages/Settings.tsx`

- Remove the "Billing Settings" card (GST number, GST %, invoice prefix) and the `handleSaveBillingSettings` handler + related state — these now live in BillingConfigPage. Clinic Profile keeps name / address / phone / email / website / logo / regional language only.

### 3. `src/App.tsx`

- `/settings/billing-config` → `BillingConfigPage` (was `BillingPage`).
- Drop `/settings/billing-config/:invoiceId` (invoice detail is reached from the patient Invoices tab via `/dashboard/billing/:id`, route already exists).
- Keep legacy redirect `/dashboard/billing → /settings/billing-config`.
- Remove the now-unused `BillingPage` import (delete `src/pages/BillingPage.tsx`).

### 4. `src/components/layout/SettingsShell.tsx`

- Rename sidebar item `"Billing"` → `"Invoice Analytics"` (icon: `BarChart3`).

### 5. `src/lib/invoicePdf.ts` and `src/lib/invoiceUtils.ts`

- Read the new optional `clinic.invoice_header_note`, `clinic.invoice_footer_note`, `clinic.show_logo_on_invoice` and render them when present. Existing layout otherwise unchanged.

### 6. `src/hooks/useClinic.tsx`

- Add the three new columns to the `clinics` select list.

## Database migration

Add three nullable columns to `public.clinics`:

```sql
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS invoice_header_note text,
  ADD COLUMN IF NOT EXISTS invoice_footer_note text,
  ADD COLUMN IF NOT EXISTS show_logo_on_invoice boolean NOT NULL DEFAULT true;
```

No RLS / grant changes (existing clinic policies cover new columns).

## Out of scope

- No change to `PatientInvoicesTab` — already the single entry point for per-invoice management.
- No change to invoice number generation logic.
- No change to `InvoiceDetailPage` route (kept for direct linking).

## Verification

1. `/settings/billing-config` → shows only Analytics tab + Configuration tab; no Create Invoice button, no invoice list.
2. Settings → Clinic Profile no longer shows GST / Invoice Prefix fields.
3. Sidebar label reads "Invoice Analytics".
4. Editing Invoice Header Note → save → open a patient invoice → Print and Download PDF both show the new header line.
5. Outstanding Patients row click → opens `/patients/:id?tab=invoices`.
6. Patient → Invoices tab still creates / records payment / shares invoices.
