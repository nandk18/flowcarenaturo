## 1. Pending Invoices → blank page

**Cause**: `PendingInvoicesPage` navigates to `/dashboard/billing/:id`. That route exists but renders `InvoiceDetailPage` inside `DashboardLayout` which does not receive a `<MainShell>` sidebar context when navigated to from a `/tasks/*` route in some cases. More importantly, `InvoiceDetailPage` shows nothing until the async fetch resolves, and if the fetch fails silently (`.single()` returns error not thrown) it stays blank forever.

**Fix**:
- `PendingInvoicesPage.tsx`: navigate to `/dashboard/billing/${r.id}` remains, but open in a fresh navigation with `state={{from:'pending-invoices'}}` (no-op unless useful).
- `InvoiceDetailPage.tsx`: surface fetch errors — show error card + Retry button when `.single()` returns error; show "Invoice not found" when data is null after loading.

## 2. Treatment / walk-in booking removes prior invoice and skips plan update

**Observed**: Completing a treatment creates invoice A. Booking another walk-in treatment for the same patient the same day causes invoice A's line items to disappear and a new invoice with only the latest treatment to appear; the plan's completed count is not incremented for either.

**Root causes**:
- `auto_create_invoice_on_appointment` trigger, when the walk-in appointment has mixed or non-treatment services, updates the existing unpaid invoice and overwrites `appointment_id = NEW.id`. When combined with the `remove_invoice_line_on_appointment_cancel` path (if the walk-in flow cancels/replaces the earlier appointment), the earlier therapy line items get rebuilt out.
- `startTreatment` only bumps `sessions_scheduled` when a matching plan item is found; walk-ins with no plan currently create a therapy_session with `treatment_plan_item_id = NULL`, so `complete_therapy_session` can't increment `sessions_completed` on the plan. User wants:
  - If a matching active plan item exists → attach it (already implemented, verify path for walk-ins).
  - If no plan exists → create an "individual" 1-session plan + item on the fly so it shows up in the plan history.

**Fix**:
- DB migration: update `auto_create_invoice_on_appointment` to append a new line item without mutating `appointment_id` on the existing invoice (keep the original appointment link, only append the line). Guard so the trigger never touches invoices whose existing `line_items[*].therapy_session_id` set is non-empty — therapy invoices are only appended to by `complete_therapy_session`.
- `AdminDashboard.startTreatment`: when no active plan item matches a treatment service, insert a new `treatment_plans` (name = "Individual — <service> — <date>", status = 'active', total_visits = 1) + `treatment_plan_items` (total_sessions = 1, sessions_scheduled = 1) and attach `treatment_plan_item_id` on the therapy_session row.
- Same behavior in `TreatmentBoard` "Start" path if it creates therapy sessions directly.

## 3. Invoice Analytics — Status filter is not a master filter, CSV missing cash/UPI totals

**Fix in `BillingConfigPage.tsx`**:
- Replace direct uses of `invoices` / `payments` in summary cards and charts with a memoized `filteredInvoices` + derived `filteredPayments` (payments whose `invoice_id` is in the filtered set) driven by ALL filters: date range, doctor, patient search, and `statusFilter`.
- Summary cards (Total, Paid, Unpaid, Collections) recompute from filtered set.
- Charts (revenue by day, by doctor, by service) recompute from filtered set.
- CSV export already respects `filteredInvoices`; add:
  - Per-row `UPI Amount` and `Cash Amount` columns (sum of `filteredPayments` for that invoice by `payment_method`).
  - Footer totals row: `TOTAL,,,,,,SUM(total),SUM(paid),SUM(outstanding),SUM(upi),SUM(cash)`.
  - Include the active filter summary in the file name (e.g. `invoices_2026-07-01_to_2026-07-08_unpaid.csv`).

## Files touched

- **DB migration** (1): update `auto_create_invoice_on_appointment` (do not overwrite `appointment_id` on existing invoice; skip invoices that are therapy-completion invoices).
- `src/pages/InvoiceDetailPage.tsx` — error/not-found states.
- `src/pages/AdminDashboard.tsx` — auto-create individual plan when walk-in has no matching plan.
- `src/pages/TreatmentBoard.tsx` — same auto-create for board-initiated starts if needed.
- `src/pages/BillingConfigPage.tsx` — global filter application + CSV cash/UPI columns and totals.

## Out of scope

- Redesign of `InvoiceDetailPage` layout.
- Migrating pending-invoices route into settings shell.
- Restructuring the invoice numbering scheme.
