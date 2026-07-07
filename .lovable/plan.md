## Scope

Seven related fixes to the clinical + billing flows.

---

### 1. Treatment status sync (Clinical Dashboard ↔ Treatment Board)

**Problem**: When a treatment is completed on the Treatment Board, its row in the Clinical Dashboard "Treatments" tab still shows as active.

**Fix**: In `AdminDashboard.tsx` treatment fetch, derive status by joining the appointment's `therapy_sessions`. When *all* linked `therapy_sessions` rows for that appointment are `status = 'completed'`, mark the appointment card as **Completed** (badge + move to "Completed" section, remove Start Treatment button). Sessions with no started rows remain "Booked". Any in-progress → "In Treatment".

No DB change required — read-time derivation using `therapy_sessions.appointment_id`.

---

### 2. Individual treatment booking does not decrement plan count

**Problem**: When "Start Treatment" runs for an ad-hoc booking, if the patient actually has a matching active plan item, the plan's `sessions_scheduled` is not incremented and the plan count stays the same after completion.

**Fix**: In `AdminDashboard.tsx` `startTreatment` reconciliation:
- For each linked service, query `treatment_plan_items` where `patient_id`, `service_id` match and `status = 'active'` AND `sessions_completed < total_sessions`.
- If found → attach `treatment_plan_id` + `treatment_plan_item_id` on the new `therapy_sessions` row AND `UPDATE treatment_plan_items SET sessions_scheduled = sessions_scheduled + 1`.
- Existing `complete_therapy_session` already decrements scheduled and increments completed → count now flows correctly.

---

### 3. Cancelled consultation must reduce invoice

**Problem**: Cancelling a consultation leaves its line item on the auto-created invoice; invoice total stays inflated.

**Fix**: New DB trigger `remove_invoice_line_on_appointment_cancel` on `appointments AFTER UPDATE` when `status` transitions to `'cancelled'`:
- Find open unpaid invoice(s) referencing this appointment via `line_items[*].appointment_id`.
- Rebuild `line_items` without the cancelled appointment's entries.
- Recompute `subtotal`, `gst_amount`, `total_amount`, `outstanding_amount = total_amount - paid_amount`.
- If line_items becomes empty AND `paid_amount = 0` → delete the invoice.

Consultations count auto-updates because dashboard already filters out `status='cancelled'` rows.

---

### 4. "TypeError: Load failed" investigation

Console shows a bare `TypeError: Load failed` (Safari's fetch-failed message) with no stack. Add a global error boundary log + retry wrapper is out of scope, but I will:
- Wrap the `AdminDashboard` treatment/consult fetches, `TreatmentBoard` fetch, and `PendingInvoices` fetch in try/catch with toast + retry button (no more blank screens).
- Confirm no unhandled `await` in `useEffect` that swallows errors silently for those three pages.

---

### 5. Sidebar → Tasks → "Pending Invoices"

- Add `{ to: "/tasks/pending-invoices", icon: Receipt, label: "Pending Invoices", badge: <count> }` to `MainShell.tsx`.
- Badge = count of `invoices` where `status IN ('unpaid','partially_paid')` for the clinic (fetched alongside careCallCount).
- New page `src/pages/PendingInvoicesPage.tsx`:
  - Date filter (default = today, changeable via date picker; also "All open" toggle).
  - Table columns: Patient name, Invoice #, Date, Total, Outstanding.
  - Row click → navigates to existing `/dashboard/invoices/:id` (`InvoiceDetailPage`).
  - Footer: "Total pending: ₹X" (sum of `outstanding_amount`).
- Add route in `App.tsx`.

---

### 6. Invoice Analytics enhancements (`BillingConfigPage.tsx`)

- Add **Status filter**: All / Paid / Unpaid / Partially paid.
- CSV export: add columns `UPI amount`, `Cash amount` (per invoice, aggregated from `payments` rows by `mode`). Append a **totals row**: `Total UPI: ₹X | Total Cash: ₹Y | Grand total: ₹Z`.

---

### 7. Edit Store Items in Settings

Current `store-items` settings page supports create/delete only. Add Edit:
- "Edit" button on each row in `src/pages/` store items settings section (locate exact file — likely inside `SettingsShell` store-items route).
- Opens the same create form pre-filled; submit does `UPDATE store_items`.

---

## Files touched

- **DB migration** (1 file): trigger + function `remove_invoice_line_on_appointment_cancel`.
- `src/pages/AdminDashboard.tsx` — treatment status derivation + plan reconciliation.
- `src/components/layout/MainShell.tsx` — sidebar entry + badge count.
- `src/pages/PendingInvoicesPage.tsx` — new.
- `src/App.tsx` — new route.
- `src/pages/BillingConfigPage.tsx` — status filter + CSV enhancements.
- Store items settings page — add Edit modal.
- `src/pages/TreatmentBoard.tsx`, `AdminDashboard.tsx` — hardened fetch/error handling.

## Out of scope

- Global Sentry-style error reporting.
- Partial-cancel refunds (only removes line items, does not create credit notes).
- Changing invoice numbering after line removal.
