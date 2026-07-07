
## 1. Calendar cancelled styling (Week + Month)

`src/pages/AvailabilityPage.tsx`

- `MonthView` (~L416) and `WeekView` (~L462): apply `line-through text-muted-foreground opacity-60` to the patient name / service text when `a.status === "cancelled"` (Day view already handles this at L542).
- The grey `cancelled` dot via `statusDot` already works — no change.

## 2. Doctor Schedule day-off auto-cancels appointments

`src/pages/DoctorSchedulePage.tsx`

- When admin toggles a weekday active → off and saves:
  1. Query `appointments` for that doctor where `EXTRACT(DOW FROM appointment_date) = <weekday>`, `appointment_date >= today`, `status IN ('scheduled','confirmed')`.
  2. If any exist, show a confirm dialog (count + earliest date) matching the leave/exception copy.
  3. On confirm: `UPDATE appointments SET status='cancelled', cancellation_reason='Doctor no longer available on <weekday>'` for those rows, then save the schedule change.
- Reuse whatever notification path the exception flow already triggers.

## 3. Treatment Board — remove "Today's capacity"

`src/pages/TreatmentBoard.tsx` (~L335)

- Delete the "Today's capacity" section entirely. No replacement.

## 4. Consult vs Treatment split — Clinical Dashboard ONLY

Scope: **Only** `src/pages/AdminDashboard.tsx` is split into two lists. The BookAppointmentModal, Availability calendar, Appointments page, Patient detail, etc. are **untouched** by the split.

Classification rule (derived at read time, no schema change):
- Fetch each today-appointment's linked `appointment_services` + `invoice_services.service_type`.
- `kind = 'treatment'` if it has ≥1 linked service and **all** linked services are `service_type='treatment'`; otherwise `kind = 'consultation'` (default when no services linked).

`AdminDashboard.tsx` changes:

- Extend the appointment fetch to include `appointment_services(invoice_services(id, name, service_type))`.
- Add a top-level toggle above `ConsultationTabs`: **Consultations | Treatments** (segmented, with counts). Persist selection in local state.
- Split `appts` into `consultAppts` and `treatmentAppts` using the classifier.
- **Consult list** (existing `ConsultationTabs`, unchanged behavior) — Active card actions:
  - `Start Consultation` (existing)
  - `Reschedule` → opens existing `RescheduleAppointmentModal`
  - `Cancel` → opens existing `CancelAppointmentModal`
  - `In progress` → `Continue`; `Completed` → `View Summary` (unchanged)
- **Treatment list** (new lightweight component `TreatmentAppointmentsTabs` in same file):
  - Active card actions:
    - `Start Treatment` (primary) — on click:
      1. Insert a `therapy_sessions` row for today: `{clinic_id, patient_id, service_id, service_name, session_date=today, session_number=1, status='not_started', amount, appointment_id: <new nullable FK>}` — one row per treatment service on the appointment.
      2. Reconcile with active plan (see §5).
      3. Update appointment `status='in_progress'`.
      4. `navigate('/treatment/board')`.
    - `Reschedule` (existing modal)
    - `Cancel` (existing modal)
  - Completed treatment card → `View` navigates to the patient's Treatment tab.
- Sessions ONLY appear on the Treatment Board after "Start Treatment" is clicked — a booked treatment appointment alone does NOT populate the board.

DB migration (minimal, only what §4/§5/§6/§7 need):
- `therapy_sessions`: add `appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL` (nullable).
- `therapy_sessions`: add `notes text` (§6).
- No `appointments.kind` column — classification stays at read time.
- Update `auto_create_invoice_on_appointment` trigger to early-return when the appointment's linked services are non-empty and all `service_type='treatment'` (prevents treatment appts from creating a consult invoice at booking time). Consult behavior unchanged.

## 5. Plan reconciliation when Start Treatment is clicked

In the `Start Treatment` handler in `AdminDashboard.tsx`, for each treatment service being converted into a `therapy_sessions` row:

- Query `treatment_plan_items` joined to active `treatment_plans` for that `patient_id` where `service_id = <selected>` and `sessions_completed + sessions_scheduled < total_sessions`.
- If found: set `treatment_plan_id` and `treatment_plan_item_id` on the new session, and `UPDATE treatment_plan_items SET sessions_scheduled = sessions_scheduled + 1`.
- If not found: insert the session with `treatment_plan_id = NULL` — treated as individual/ad-hoc treatment.
- Toast summary: "Started N session(s). Used M from active plans."

## 6. Notes field for therapist visibility

- `therapy_sessions.notes` added in §4 migration.
- `src/pages/TreatmentSchedule.tsx` (plan builder): add optional "Notes for therapist" textarea per plan item; store on `treatment_plan_items` **and** copy onto any `therapy_sessions` row created for the item (today's session + future Start Treatment insertions).
  - Add `treatment_plan_items.notes text` in the migration too.
- `BookAppointmentModal.tsx`: the existing `notes` field is already captured on the appointment. On `Start Treatment` (§4), copy `appointments.notes` into each created `therapy_sessions.notes` (fallback to plan item notes if empty).
- `TreatmentBoard.tsx`: render the notes preview (2-line truncate) on each session card.
- `TherapistApp.tsx`: show full notes in the session detail as a yellow "Notes" callout.

## 7. Invoice on treatment completion

Modify `complete_therapy_session` DB function:

- After marking the session `completed`, find today's open unpaid invoice for `(clinic_id, patient_id, invoice_date=CURRENT_DATE, status='unpaid')`:
  - Exists → append line item `{name: service_name, quantity: 1, unit_price: amount, gst_percentage, total, therapy_session_id}`, recompute `subtotal / gst_amount / total_amount / outstanding_amount`.
  - Not exists → create a new unpaid invoice with just that line item (reuse `INV-YYYY-NNNN` numbering pattern from `auto_create_invoice_on_appointment`).
- Skip if `amount` is 0 or NULL.
- Combined with the trigger change in §4, treatments never invoice at booking, only at completion.

## Technical notes

- Single migration file: `therapy_sessions.appointment_id`, `therapy_sessions.notes`, `treatment_plan_items.notes`, updated `auto_create_invoice_on_appointment`, updated `complete_therapy_session`. No new tables → no new `GRANT`s.
- Availability calendar, Appointments page, Patient pages: unchanged aside from §1 strikethrough.
- Reschedule/Cancel on Clinical Dashboard use the existing modal components.
- Treatment Board query is unchanged; sessions inserted by Start Treatment appear on today's board automatically.

## Out of scope

- Splitting consult vs treatment anywhere outside Clinical Dashboard.
- Patient notification when a weekday is disabled (beyond existing cancel flow behavior).
- UI for editing a session's `notes` after creation (read-only for now).
- Bulk "Start all treatments for today" action.
