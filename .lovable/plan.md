## Fix 1 — Treatment tab lists consult service too

**Where:** `src/pages/AdminDashboard.tsx` (TreatmentTabs / treatment card renderer).

The treatment card iterates every `appointment_services` row, so a mixed appointment (Consultation + Foot Reflexology) shows both service names under the Treatment tab.

**Change:** When rendering a treatment appointment card, filter the displayed service list to only rows where `invoice_services.service_type === 'treatment'`. The consult service still belongs to the appointment (and appears under the Consultations tab), but must not be shown/count under Treatments.

Also apply the same filter anywhere the treatment card builds a subtitle, chip list, or "services" summary from `appt.services`.

No DB change; purely presentational.

## Fix 2 — Allow a 2nd same-service session same day on the Board

**Where:** `src/lib/createTherapySession.ts` (dedup step) and `src/pages/TreatmentBoard.tsx` (`addTherapyForPatient`).

Currently `createTherapySession` returns `isExisting: true` whenever a non-cancelled session for the same patient/service/day exists, and the Board shows the "already on today's board" toast — blocking manual re-add.

**Change:** Add an `allowDuplicate?: boolean` parameter to `createTherapySession`. When true, skip the dedup lookup and always create a new session (incrementing `session_number` off the plan item as usual).

Wire the Board's "+ Add therapy" flow to pass `allowDuplicate: true` — user explicitly picked the service, so a repeat is intentional. The auto flows (`startTreatmentForAppointment`, `ensureIndividualPlanForServices`) keep the current dedup behavior so bookings stay idempotent.

Update the Board toast text to "Added 2nd session of {service}" when the plan item's `session_number` for today is > 1.

### Technical notes
- No schema changes.
- Files touched: `src/pages/AdminDashboard.tsx`, `src/lib/createTherapySession.ts`, `src/pages/TreatmentBoard.tsx`.
- `startTreatmentForAppointment` continues to call `createTherapySession` without the flag → mixed-appt "Start Treatment" stays idempotent.
