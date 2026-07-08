## Plan

### 1. Add Cancel + Reschedule actions for active consultations
- Update the Clinical Dashboard consultation active list so scheduled, waiting, and in-progress consult appointments can show Cancel / Reschedule controls like treatment rows.
- Keep completed consults read-only with “View Summary”.
- Reuse the existing `CancelAppointmentModal` and `RescheduleAppointmentModal` already wired in `AdminDashboard.tsx`.

### 2. Fix treatment plan reuse when booking/walk-in adds a therapy already in a plan
- Update treatment-start logic so a booked/walk-in treatment first searches the patient’s active treatment plan item for the same service.
- If a matching active plan item exists, schedule against that item and increment `sessions_scheduled`, so progress becomes like `2/6` instead of creating a new individual plan.
- Only create an individual one-session plan when no active plan item exists for that service.

### 3. Stop duplicate individual plans and 0/0 progress
- Make `ensureIndividualPlanForServices` fully idempotent by appointment marker and by patient/service active item reuse.
- Adjust `startTreatmentForAppointment` so it does not expand or duplicate plans incorrectly after booking already created a plan item.
- Fix progress calculations defensively in `PatientTreatmentTab.tsx` so empty orphan plans do not show as `0/0 done`.

### 4. Align booking and start-treatment behavior
- Keep treatment-only appointments from creating consultation visits.
- Ensure booking-time plan creation and Start Treatment use the same reuse rule: existing plan item first, individual plan only as fallback.

### 5. Validate
- Run a TypeScript check/build signal after changes.
- Verify the relevant UI paths: Clinical Dashboard consult active actions, treatment booking/start flow, and Patient Treatment tab progress display.