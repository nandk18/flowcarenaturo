# Six-Issue Fix Plan

This is a large set of changes. I'll group them so each fix is self-contained, and reuse one shared search component where possible.

---

## Fix 1 — Reschedule Appointment (proper flow)

**DB migration** (additive, safe):
- `appointments`: add `rescheduled_from uuid`, `rescheduled_to uuid` (nullable, self-FK).

**New component** `src/components/appointments/RescheduleAppointmentModal.tsx`:
- Shows current patient / date / time / doctor (read-only).
- Inputs: New Date, New Time (filtered to doctor's available slots via existing `scheduleSlots` helper), optional Reason.
- On Confirm:
  1. INSERT new appointment copying all fields except date/time, set `rescheduled_from = old.id`, `status='scheduled'`.
  2. UPDATE old: `status='cancelled'`, `cancellation_reason='Rescheduled'`, `notes` appended with "Rescheduled to …", `rescheduled_to = new.id`.
  3. **Skip auto-invoice** on the new row: the existing `auto_create_invoice_on_appointment` trigger fires on INSERT. To avoid a duplicate invoice, either (a) detect on the client and immediately delete the freshly-created duplicate invoice row, or (b) add a trigger guard `WHEN (NEW.rescheduled_from IS NULL)`. Going with (b) via migration — cleaner.
- Toast confirmation, refresh caller.

**Wire-up**:
- `AvailabilityPage` Day-view booked-slot popover: replace existing reschedule button to open this modal (not `BookAppointmentModal`).
- `PatientDetailPage` Appointments tab: add Reschedule button beside Cancel.

**History display** in patient Appointments tab:
- If `rescheduled_from` set → amber "Rescheduled" badge + "Originally: <old date/time>" muted line.

---

## Fix 2 — Services search in Book Appointment

In `BookAppointmentModal.tsx`, replace the current pills selector with:
- Search input (filters `invoice_services` by name, clinic+active).
- Dropdown of matches showing name + ₹amount.
- Selected items as removable chips with running total.
- Empty state: "No services found. Configure in Settings → Billing → Invoice Services".

---

## Fix 3 — Services search in Invoice tab

Generalise existing `ServicePicker` to match `StoreItemPicker` UX (it mostly does already — just align styling, button placement, and ensure it adds line items identically). Place `[Add Service] [Add Store Item]` side-by-side in `InvoiceServicesSection` / invoice detail panel.

---

## Fix 4 — Call Task layout restructure

Rewrite `src/pages/CallTaskPage.tsx`:
- **Level 1**: three stat pills (Overdue / Due Today / Done Today), single-active, default Overdue.
- **Level 2**: four sub-tabs (Appointment Tomorrow / Care Call / Cancelled Call / Lead Call), single-active, default Lead Call.
- Unified row-card component with type badge, name link, phone + WhatsApp, type-specific info line, note input, Log Call dropdown with type-specific outcomes.
- Done Today view groups today's `call_logs` by type.
- Empty states per combination.
- Remove Care Call entry from `MainShell` sidebar.

---

## Fix 5 — Patient-linked To-Do

`todo_list` already has `patient_id`.
- `PatientDetailPage` General tab: place existing `PatientTodoCard` in the right column as the last card (below Contact Notes). Upgrade Add → modal with title/description/priority/due date and locked patient chip.
- `TodoListPage`: show "For: <Patient> →" teal hyperlink chip when `patient_id` set; add filter tabs [All / Patient Tasks / General Tasks]; in Add Task modal add optional patient search field.

---

## Fix 6 — Freeform template + voice scribe

**DB migration**: add `is_default boolean default false` to `note_templates`; partial unique index per `clinic_id` where `is_default`. Ensure a "Free-form" system template row exists with `template_type='freeform'`.

**Settings → Templates** (`TemplatesPage.tsx`):
- Switch source from hardcoded list to `note_templates` rows.
- Card shows name, type badge (SOAP/Freeform), description, Active toggle, "Set as Default" button (exclusive per clinic).

**ConsultationWorkspace**:
- Read default template on mount; if `template_type='freeform'` render a single tall "Clinical Notes" textarea bound to `freeform_notes`, hide SOAP sections entirely.
- Template dropdown actually switches the UI based on selected template's `template_type` and persists `template_type` + `template_name` on `clinical_notes`.
- Header shows "📝 Freeform Notes" or "📋 SOAP Notes".

**VoiceRecorder / format-soap-notes**:
- When freeform active, call existing `format-soap-notes` edge function with `mode:'freeform'` (already supported) and write result to `freeform_notes`.

**Patient Clinical Notes tab**:
- Render based on `template_type`: freeform → plain paragraphs; soap → existing S/O/A/P layout.

---

## Order of execution

1. Run DB migration (appointments columns + reschedule trigger guard, `note_templates.is_default`, seed Free-form template if missing).
2. Build shared pieces (`RescheduleAppointmentModal`, generalised service search behaviour).
3. Wire UI changes per fix.
4. Verify each of the 6 flows manually.

## Technical notes

- Trigger guard SQL:
  ```sql
  CREATE OR REPLACE FUNCTION ... -- wrap existing auto_create_invoice_on_appointment
  -- early RETURN NEW when NEW.rescheduled_from IS NOT NULL;
  ```
- Single-default enforcement via partial unique index:
  ```sql
  CREATE UNIQUE INDEX note_templates_one_default_per_clinic
  ON public.note_templates(clinic_id) WHERE is_default;
  ```
- No breaking changes to existing data; all new columns are nullable / default false.

Estimated diff size: ~1.5–2k lines across ~12 files. Please approve and I'll implement straight through.
