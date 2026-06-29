## Fixes for prior pass

### 1. Move calendar enhancements to Availability page

The Reschedule button, "show services next to patient name", and clickable cancelled rows were added to `AppointmentsPage.tsx`. They should live on `AvailabilityPage.tsx` (the actual calendar view) instead.

- **`src/pages/AvailabilityPage.tsx`**
  - Extend the appointments query to include `appointment_services(invoice_services(name))`, map into `services: string[]` on each `Appt`.
  - In day/week/month cell renderers, show services after patient name: `Asha Rao · Consultation, Panchakarma` (first 2 + `+N`).
  - Add a **Reschedule** button next to **Cancel** in the appointment popover/sheet; opens `BookAppointmentModal` pre-filled with patient + services and sets old row `status='rescheduled'` on submit.
  - Wrap cancelled rows in the bottom list (if present) — or the cancelled badge in the cell — in a clickable button that opens the same popover (read-only + Reschedule).
- **`src/pages/AppointmentsPage.tsx`** — revert the three additions (services line, Reschedule button, clickable cancelled rows) so the page goes back to its previous behaviour.

### 2. Call Tasks: top-level KPI tabs

Restructure `src/pages/CallTaskPage.tsx`:

- **Primary tabs (top, apply across all types):** `Overdue` · `Due Today` · `Done Today`. Show counts. Drives a `statusFilter` state.
- **Secondary tabs (below):** `Appointment Tomorrow` · `Care Call` · `Cancelled Call` · `Lead Call` (existing 4). Drives `typeFilter`.
- Each section's list is filtered by the combination. URL state: `?status=overdue&type=care`.
- "Due today" definitions per type:
  - Appt Tomorrow → due = today (always).
  - Care Call → `care_call_due_date = today`; overdue → `< today`.
  - Cancelled Call → not yet informed and `called_at::date = today` (overdue: older than today).
  - Lead Call → patients in `attempt1/2/3` with `call_due_date` today / before today; done today = `call_logs` rows with `outcome` set today.

### 3. Voice Scribe: Freeform as a template

Currently Free-form is a separate toggle in `VoiceRecorder.tsx`. Change it to a real template.

- **DB (seed only, via insert tool — not a schema change):** add a system row in `note_templates` with `name='Free-form'`, `is_system=true`, `sections=[]` (or a single `formatted` section). Already-present `Free-form` rows are upserted by name+is_system.
- **`src/components/doctor/TemplateSelector.tsx`** — no code change; the new template shows up automatically. Doctors can pick "Free-form" as default in Settings → Doctor profile (existing UI).
- **`src/components/doctor/VoiceRecorder.tsx`** — remove the freeform localStorage toggle; instead detect `template.name === "Free-form"` and pass `mode: "freeform"` to the edge function based on that.
- **`src/components/doctor/ConsultationWorkspace.tsx`** — when the active template is "Free-form", render the existing single-textarea formatted output in the SOAP section (same component as today, just driven by template, not toggle).
- **`supabase/functions/format-soap-notes/index.ts`** — keep the `mode === "freeform"` branch; no change needed.

### 4. Patient To-Dos: move under Patients tab area + link in sidebar Todo

`PatientTodoCard` is already on the patient detail page (line 411). Ensure it lives inside the Patients/* tab strip rather than a free-floating card, and confirm `TodoListPage` shows the patient chip with link.

- **`src/pages/PatientDetailPage.tsx`** — move `<PatientTodoCard …/>` into the patient tabs as a new tab "To-Do" (alongside Appointments / Notes / Invoices), so it's clearly under `/patients/:id`.
- **`src/pages/TodoListPage.tsx`** — verify patient chip renders for tasks with `patient_id`, clicking navigates to `/patients/:id`. Add if missing.
- No DB change — `todo_list.patient_id` already exists from prior migration.

### Out of scope
- Changes to BookAppointmentModal beyond pre-fill support (already done).
- Reworking the Lead Call query — only wraps with the new status/type filters.

### Verification
1. `/availability` calendar cells show `Patient · Service1, Service2`.
2. Click an appointment → popover shows Reschedule + Cancel; Reschedule opens prefilled Book modal; old row becomes `rescheduled`.
3. Cancelled appointments in calendar are clickable.
4. `/appointments` no longer shows those three additions.
5. `/call-tasks` shows Overdue / Due Today / Done Today as primary tabs; type tabs below; counts match the filter combo.
6. In consult, picking "Free-form" template makes voice transcription return free-form text into the SOAP section.
7. `/patients/:id` has a To-Do tab; tasks added there appear in sidebar Todo with a clickable patient chip.
