# Fix mixed booking dashboard split + Review 404

## Issue 4 — `/review/:token` returns 404 (root cause found)
In `src/App.tsx`, the **public-only routes branch** (the `if` around lines 194-225 that returns `<Routes>` with only public routes) does not include `/review/`. So an unauthenticated visitor hitting `/review/<token>` falls through to the authenticated app shell where no matching `<Route>` is mounted → `NotFound` renders (looks like a 404). The `isPublicRoute` helper was updated, but this second branch was missed.

**Fix (one file, `src/App.tsx`):**
- Add `path.startsWith("/review/")` to the condition of the public-only branch.
- The `<Route path="/review/:token" element={<ReviewSubmit />} />` line is already there — no other change needed.

## Issue 1 — Consult + Treatment booked together: only consult shows on Clinical Dashboard
Symptom: booking one appointment with both a consultation service and a treatment service produces a "Consultation" row on the Clinical Dashboard but no treatment row / no therapy session.

**What needs verification (I'll open these in build mode before editing):**
- `src/components/appointments/BookAppointmentModal.tsx` — confirm all selected services are written to `appointment_services` (not only the first) and no early-return skips treatments when a consult is present.
- `src/pages/AdminDashboard.tsx` — how it classifies an appointment as consult vs treatment. Likely it categorizes by "first service" or "any consult ⇒ consult only", hiding the treatment side of a mixed appointment.
- `startTreatmentForAppointment` / auto-start flow — a mixed appointment has `isTreatmentOnlyAppointment === false`, so the "Start Treatment" path never runs and no `therapy_sessions` are created for the treatment services on that appointment.

**Fix plan:**
1. **BookAppointmentModal**: ensure every selected service (consult + treatments) is inserted into `appointment_services`. If it already does, this step is a no-op.
2. **AdminDashboard**: for each appointment, render it in **both** streams when it has mixed service types — a Consult card in the consult queue AND a Treatment card in the treatment queue. Card actions ("Start consultation" vs "Start treatment") are scoped to the relevant services only.
3. **Treatment start on mixed appointments**: extend `startTreatmentForAppointment` so it processes only the treatment services on the appointment (already filters to treatments) and is callable even when the appointment also has consult services. Add a "Start Treatment" action on the treatment-side card that calls this without touching the consult side.
4. **Invoice trigger** already handles mixed correctly (consultation line auto-created; therapy line added on completion) — no DB migration required.

## Out of scope this turn
Items 2, 3, 5 from the previous message (status sync after cancel/complete, calendar WhatsApp button) are deferred until these two are shipped.

## Technical notes
- No DB migration.
- Files touched: `src/App.tsx`, `src/components/appointments/BookAppointmentModal.tsx` (verify only), `src/pages/AdminDashboard.tsx`, `src/lib/treatmentStart.ts` (small guard change if needed).
- Frontend-only fix; user must click **Publish → Update** for the review link and dashboard changes to appear on `flowcarenaturo.lovable.app`.
