## Fixes

### 1. Consultation completion shouldn't mark treatment as completed (and vice versa)
**Where:** `src/pages/AdminDashboard.tsx` — the "complete consultation" action currently updates the appointment row to `completed`, which cascades the whole appointment (both consult + treatment services) out of the Active queue.

**Fix:** For mixed appointments (has consultation AND treatment), don't flip `appointments.status` when completing the consult side. Instead track consult completion separately:
- Use `visits.status = 'completed'` as the source of truth for the consultation side (already created on consult check-in).
- Update the dashboard's `hasConsultation`/`hasTreatment` split so:
  - Consultation card is hidden when the appointment has a completed `visits` row.
  - Treatment card is hidden only when all its `therapy_sessions` are `completed`/`cancelled` (the DB trigger already handles the appointment status for pure-treatment appointments).
- Only mark `appointments.status = 'completed'` when the appointment has no treatment services, OR when both the visit is completed and all sessions are done (leave the latter to the existing `sync_appointment_status_from_sessions` trigger by checking visit status inside it too).

### 2. Empty patient card on Treatment Board after cancellation
**Where:** `src/pages/TreatmentBoard.tsx` — patient groups are rendered even when all their sessions for the day are cancelled with no remaining active ones.

**Fix:** Filter out patient groups whose sessions are all `cancelled` (keep groups that have at least one `not_started`/`in_progress`/`completed`). Also collapse the "+ Add therapy" empty patient placeholder when there is no active plan and no non-cancelled session.

### 3. "Send review" button in Therapist App for completed sessions
**Where:** `src/pages/TherapistApp.tsx` `SessionCard` completed branch.

**Fix:** Add a small "Send review" button next to the completed timestamp that calls the existing `sendReviewLinkForSession(s.id)` (same util already used on auto-complete and on the Board). Handles resend if the patient didn't get the WhatsApp message.

### Technical notes
- No schema changes required for #2 and #3.
- For #1, update the trigger `sync_appointment_status_from_sessions` (or a companion visit trigger) so an appointment is marked `completed` only when: all non-cancelled therapy sessions are completed AND (no visit exists OR visit is completed). Adjust `AdminDashboard` filters to drive UI from `visits.status` + session aggregates rather than only `appointments.status`.
