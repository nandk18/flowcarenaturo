# Fix Treatment Appointment Flow

Three related issues, all rooted in the app treating every appointment as a consultation.

## 1. Treatment appointment shows "Start Consultation"

**Where:** `src/pages/SalesPatientDetail.tsx` → `renderAction` (line ~1548) / `startConsultation` (line ~1496) inside the Appointments tab.

Right now every scheduled appointment for today renders the green **Start Consultation** button, even when the booked services are all `service_type = 'treatment'`.

**Fix:**
- Derive `apptKind` per row from the already-fetched `appointment_services → invoice_services.service_type` (same logic used in `BookAppointmentModal`): if every linked service is `treatment` → `"treatment"`, otherwise `"consultation"`.
- In `renderAction`, when `apptKind === "treatment"` and status is `scheduled`/`in_progress`, render an **Start Treatment** button (teal, `Activity` icon) that:
  - Marks the appointment `in_progress`.
  - Calls the existing `startTreatment` flow (extract the shared logic from `AdminDashboard.startTreatment` into a small helper in `src/lib/treatmentStart.ts` and call it from both places) — it already ensures a plan/plan-item exists and creates the `therapy_sessions` row.
  - Navigates to `/treatment/board`.
- For `completed` treatment appointments, show a **View on Board** link instead of "View Summary".

## 2. Clinical notes / visit is created for treatment-only appointments

Same root cause: `startConsultation` unconditionally inserts into `visits` and later a clinical note/prescription can be attached. With the split above, treatment-only appointments never enter that path, so no `visits`/`clinical_notes` row is ever created for them.

Also update `convertToVisit` in `src/pages/AppointmentsPage.tsx` (line ~269) to guard the same way — if the appointment is treatment-only, route to the board instead of pushing a token into the visit queue.

No DB changes; strictly a UI/routing guard.

## 3. Treatment Tab shows no progress for individual / plan-only-after-"What to do Today"

**Where:** `src/components/patient/PatientTreatmentTab.tsx` reads `treatment_plans` + `treatment_plan_items` and computes progress from `sessions_completed / total_sessions`.

Two gaps:
- **Individual walk-ins:** the "Individual — <service>" plan is created lazily inside `AdminDashboard.startTreatment`. If the user just booked a treatment appointment (and never opened the admin start), no plan exists yet, so the Treatment tab is empty.
- **Plan progress lag:** `sessions_completed` only increments when the therapist marks a session complete on the board. Until then the tab shows `0/N` even after sessions were scheduled. The user expects "in progress" visibility (scheduled vs completed).

**Fix:**
- Move the "auto-create individual plan + item" block out of `AdminDashboard.startTreatment` into the shared `startTreatment` helper from item 1, so it also fires when treatment is started from `SalesPatientDetail`. This guarantees every treatment appointment produces a plan row.
- Alternative earlier point: run the same "ensure individual plan" logic inside `BookAppointmentModal` right after inserting the appointment when `bookingKind === "treatment"` and no active plan matches. That way the Treatment tab lights up the moment the appointment is booked, before anyone touches the board. Pick this location.
- In `PatientTreatmentTab`, extend the row to also show `sessions_scheduled` (already fetched — just add to select): render `completed / scheduled / total` and split the progress bar into a filled `completed` segment plus a lighter `scheduled` segment. This removes the "nothing happens until Complete" perception.
- Refetch on mount **and** subscribe to `treatment_plans` / `treatment_plan_items` / `therapy_sessions` changes for this `patient_id` via a single Supabase channel (cleaned up on unmount) so the tab updates live when the board changes state.

## Technical section

Files touched:
- `src/lib/treatmentStart.ts` — new. Exports `ensureIndividualPlanForServices(...)` and `startTreatmentForAppointment(...)`; consolidates plan/item lookup, individual-plan creation, and `therapy_sessions` insertion currently duplicated in `AdminDashboard.startTreatment`.
- `src/pages/AdminDashboard.tsx` — replace inline `startTreatment` body with call to the helper.
- `src/pages/SalesPatientDetail.tsx` — compute `apptKind` per row in `loadAppointments`; branch `renderAction`; add `startTreatmentAction` using the helper; adjust "View Summary" branch.
- `src/pages/AppointmentsPage.tsx` — guard `convertToVisit` for treatment-only appointments.
- `src/components/appointments/BookAppointmentModal.tsx` — after insert, when `bookingKind === "treatment"`, call `ensureIndividualPlanForServices` so a plan row exists immediately.
- `src/components/patient/PatientTreatmentTab.tsx` — select `sessions_scheduled`, render scheduled+completed+total, add realtime subscription, split progress bar.

No SQL migration required — `sessions_scheduled` and `sessions_completed` columns already exist.
