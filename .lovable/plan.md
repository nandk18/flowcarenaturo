# Plan: Multi-area workflow improvements

## 1. Searchable Service pickers (replace dropdowns)

**`src/components/billing/ServicePicker.tsx`** — replace `Select` with a `Command`-based typeahead combobox:
- Input filters `invoice_services` by `name` (case-insensitive, substring).
- Multi-select: clicking an item appends to selected list; selected services render as removable chips above the input.
- Keyboard: ↑/↓ to navigate, Enter to add, Backspace on empty input removes last chip.
- Used in `CreateInvoiceModal` and `InvoiceServicesSection` (already imports `ServicePicker`).

**`src/components/appointments/BookAppointmentModal.tsx`** — same combobox for "Services" field (currently a `Select`). Stores selected service IDs on `appointment_services` link rows just like today.

## 2. Calendar improvements

**`src/pages/AppointmentsPage.tsx`** (calendar view) and the appointment detail popover/sheet:

- **Show services next to patient name** in calendar cells/list rows: fetch `appointment_services → invoice_services.name`, render as small muted text after patient name (e.g. `Asha Rao · Consultation, Panchakarma`). Limit to first 2 + "+N".
- **Reschedule button** next to Cancel on the appointment detail popover:
  - Opens existing `BookAppointmentModal` pre-filled with patient, doctor, services.
  - On submit: insert new appointment, set old row `status = 'rescheduled'` (add to enum if missing).
- **Cancelled appointments clickable**: in the bottom "Cancelled" list, wrap each row in a button that opens the same detail popover (read-only badge + Reschedule option). Today they're rendered as plain text.

**`src/components/appointments/CancelAppointmentModal.tsx`** — reason dropdown becomes exactly:
- `Patient Requested`
- `No Show`
- `Other` (shows free-text input)

Remove all other reasons. Remove the "create cancel call" side-effect that currently runs for non-doctor-leave cancellations.

## 3. Doctor's Leave → bulk Cancel Calls

**`src/pages/DoctorSchedulePage.tsx`** — add "Mark Leave" action per doctor/day:
- Picks date(s); on confirm: set all that day's appointments for that doctor to `cancelled` with reason `doctor_leave`, AND insert a `call_logs`-style task row for each affected patient into Call Tasks with type `cancelled_call`.
- This is the ONLY path that generates cancelled-call tasks. Patient/No-show/Other cancellations do NOT create call tasks.

No new settings page — leave-cancel flow lives entirely on Doctor Schedule.

## 4. Call Tasks redesign

**`src/pages/CallTaskPage.tsx`**:

Top KPI cards become clickable filter tabs:
- `Overdue`
- `Due Today`
- `Done Today`

Below KPIs, a secondary tab strip with four type filters (combine with the KPI filter above):
- `Appointment Tomorrow`
- `Care Call`
- `Cancelled Call`
- `Lead Call`

List re-queries based on the combination. URL state via `useUrlState` for shareability.

**`src/components/layout/MainShell.tsx` / sidebar** — remove the standalone "Care Call" sidebar item. Care calls only live inside Call Tasks now.

## 5. Petty Cash → Front Desk Expenses

- **Move** the Top-up / Withdraw + balance UI out of `src/pages/PettyCashSettingsPage.tsx`.
- **Add a "Petty Cash" panel** at the top of `src/pages/ExpenseListPage.tsx`:
  - Cards: Current Balance, Total Spent (sum of `expense_list` paid via Petty Cash for current month), Limit.
  - Inline Top-up / Withdraw buttons (uses existing `adjust_petty_cash` RPC).
- **Settings → Petty Cash page**: keep only the Maximum Limit field (admin policy setting). Remove from sidebar if user prefers; default keep with limit-only.
- Remove sidebar "Petty Cash" settings item — fold limit into Billing Config or leave a slim settings entry. (Will keep slim settings entry for limit; confirm if you want it gone entirely.)

## 6. Patient-linked To-Dos

**`src/pages/PatientDetailPage.tsx`** — add "To-Do" section/tab:
- Lists `todo_list` rows where `patient_id = currentPatient.id`.
- "Add task" inline form; saves with `patient_id`, `clinic_id`, `created_by`.

**`src/pages/TodoListPage.tsx`** — show linked patient name as a chip; clicking jumps to `/patients/:id`.

Migration: ensure `todo_list.patient_id uuid references patients(id) on delete set null` exists; add if missing + index.

## 7. Voice scribe — free-form mode

**`src/components/doctor/VoiceRecorder.tsx`** + **`src/components/doctor/TemplateSelector.tsx`**:
- New default mode: "Free-form" — sends transcript to a new lightweight formatter prompt (no SOAP fields, just cleaned/punctuated paragraphs in clinical English; preserves bullet structure if dictated).
- Template selector keeps existing SOAP/custom templates as an opt-in toggle: "Free-form ↔ Use template".
- **`supabase/functions/format-soap-notes/index.ts`**: branch on `mode === "freeform"` → return `{ formatted_text: "..." }` instead of SOAP JSON. Component renders the text in a single editable textarea when free-form.

## Technical notes

- DB:
  - Add `appointment_status` enum value `rescheduled` if not present.
  - Add `call_logs.type` enum value `cancelled_call` if not present.
  - Ensure `todo_list.patient_id` FK + index.
- No new public-schema tables expected; all changes are columns/enums on existing tables, so no new GRANT blocks needed beyond existing.
- Realtime: existing channels on `appointments` and `todo_list` cover the new flows.
- Routing: no new routes; existing `/call-tasks`, `/expenses`, `/patients/:id`, `/appointments`, `/doctor-schedule` reused.

## Out of scope (ask if wanted)

- Recurring doctor leave (multi-day vacations) — single-day for now.
- WhatsApp auto-notify on doctor-leave cancellations — uses existing message template if present, otherwise skipped.
- Migrating historical cancellation reasons to the new 3-value set.

## Verification

1. Book Appointment: typing in Services filters list; multi-select chips work.
2. Create Invoice: same typeahead behavior; selected services appear as line items.
3. Calendar cell shows `Patient · Service1, Service2`.
4. Click cancelled patient → popover opens; Reschedule pre-fills Book modal.
5. Cancel modal shows only 3 reasons; no Call Task created.
6. Doctor Schedule → Mark Leave → all that day's appointments cancelled + Call Tasks list shows new Cancelled Calls.
7. Call Tasks: clicking Overdue/Due Today/Done Today filters; sub-tabs filter by type. Sidebar Care Call gone.
8. Expenses page: Petty Cash card with balance/spent + Top-up works. Settings → Petty Cash shows only limit.
9. Patient detail → To-Do tab → add task → appears in main Todo list with patient chip.
10. Consult voice recorder: default free-form produces formatted paragraphs; toggle to template restores SOAP output.