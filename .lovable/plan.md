# Fix Treatment flow: duplicates, clinical notes, and Schedule merge

## 1) Duplicate "Individual —" plans on booking + Start Treatment

**Root cause:** `BookAppointmentModal` calls `ensureIndividualPlanForServices` at booking time, and `startTreatmentForAppointment` also creates an individual plan if it can't reuse one. Any mismatch (e.g. sessions_scheduled already bumped, service_id mapping, or a second call) creates a second plan, leaving one plan orphaned with `total=0, completed=0` → shows `0/0 done`.

**Fix — make booking the single source of truth:**
- Keep `ensureIndividualPlanForServices` at booking time (already there). Change it to be idempotent per (patient, service, appointment): tag created plans with `source_appointment_id` (store in `treatment_plans.notes` JSON prefix or a new column — reuse existing `notes` field with `[appt:<id>]` marker for zero migration).
- In `startTreatmentForAppointment`:
  - First look up plan items linked (via marker or via matching active individual plan with remaining>0) for the appointment's services.
  - Only fall back to creating a new plan if none exist AND booking was skipped (walk-in path).
  - Never create a second `Individual — <svc>` plan if one already exists for that patient+service with `total_sessions >= 1` and any remaining capacity — reuse it.
- Cleanup: on load in `PatientTreatmentTab`, filter out plans where `total_sessions == 0 AND items.length == 0` (defensive, so historical orphans don't display).
- One-time SQL cleanup migration: delete `treatment_plans` rows with no `treatment_plan_items` and `status='active'` older than the fix (safe, they are empty).

## 2) Clinical Notes tab still shows "Consultation" for treatment appointments

**Root cause:** `loadClinicalNotes` reads from `visits`. A DB trigger (`auto_create_visit_on_appointment` or similar) still creates a `visits` row for every appointment regardless of service type, so treatment-only appointments appear as consultations in the Clinical Notes tab.

**Fix:**
- Add a DB migration updating the visit-creation trigger to skip appointments where every linked `appointment_services.service_id` maps to `invoice_services.service_type = 'treatment'`.
- In `loadClinicalNotes`, additionally filter out visits whose linked appointment is treatment-only (defense in depth for existing rows): join `appointments → appointment_services → invoice_services` and drop visits where all services are treatment and there are no `clinical_notes` / `prescriptions`.
- No UI copy changes needed elsewhere.

## 3) Merge "Schedule Therapy" into Treatment Board

**Goal:** Remove the standalone Schedule page from navigation; expose it inside the Board.

**Changes:**
- `src/pages/TreatmentBoard.tsx`: add a primary "New Plan / Schedule Therapy" button in the header that opens `TreatmentSchedule` inside a full-screen `Dialog` (or slide-over `Sheet`). Support `?patient_id=` deep link by auto-opening the dialog when the query param is present.
- `src/pages/TreatmentSchedule.tsx`: extract the body into a reusable `<TreatmentScheduleForm patientId? onDone />` component; keep the page as a thin wrapper that redirects to `/treatment/board?patient_id=…` (so existing bookmarks still work).
- Update all callers to point at the Board instead:
  - `src/components/patient/PatientTreatmentTab.tsx` "New Plan" → `/treatment/board?patient_id=…&new=1`
  - `src/pages/SalesPatientDetail.tsx` line 1012 "New Plan" → same
  - `src/components/doctor/ConsultationWorkspace.tsx` line 848 → same
  - `src/components/layout/MainShell.tsx`: remove the "Schedule Therapy" sidebar item.
  - `src/pages/TreatmentIndex.tsx`: remove the "Schedule Therapy" card (leave Board + Therapists).
- `src/App.tsx`: keep `/treatment/schedule` route pointing to the thin redirect wrapper so old links don't 404.

## Technical notes

- No schema change required for #1 beyond the cleanup delete; the appointment marker fits in `treatment_plans.notes` (text).
- Trigger change in #2 must be idempotent (`CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`).
- `TreatmentSchedule` currently uses `DashboardLayout`; the extracted form must not render its own layout when embedded in the Board dialog.

## Out of scope

- No visual redesign of the Board beyond the added button and dialog.
- No changes to therapist app or push flow.
