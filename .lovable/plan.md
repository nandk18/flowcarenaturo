# Treatment module fixes

## 1. "New Plan" button on Clinical Notes tab
In `src/pages/SalesPatientDetail.tsx` (which powers the patient detail view including Clinical Notes), add a "New Plan" button in the `ClinicalNotesTab` header (next to the search) that navigates to `/treatment/schedule?patient_id=<id>`. Only render when `treatmentEnabled` is true. Style/behavior matches the existing "New Plan" button in `PatientTreatmentTab`.

## 2. Therapist can't start a second concurrent session for the same patient
In `src/pages/TherapistApp.tsx` `doStart()`, before updating status to `in_progress`, query `therapy_sessions` for that patient on today with `status = 'in_progress'`. If any exist, toast an error ("Patient already has an ongoing session — complete it first") and abort. Also disable the Start button on the card when the patient has another in-progress session visible in the current `sessions` list.

Apply the same guard in `src/pages/TreatmentBoard.tsx` `startSession()`.

## 3. Don't auto-invoice treatment appointments; bill on completion
- **Booking side** (`src/components/appointments/BookAppointmentModal.tsx`): when the appointment's selected services include a treatment (service_type='treatment'), skip the invoice line-item override for those rows. If ONLY treatments are selected, don't create/attach an invoice at all — the existing DB trigger `auto_create_invoice_on_appointment` still fires with a default consultation line, so we need a way to suppress it. Options:
  - **Preferred**: modify `auto_create_invoice_on_appointment` trigger via migration to check whether the appointment has any linked `appointment_services` of type 'consultation' (or none linked yet → default consultation). If the only linked services are 'treatment', do not create/modify an invoice.
  - Frontend then always inserts `appointment_services` BEFORE relying on the trigger, or the trigger is deferred. Simplest: change modal to insert `appointment_services` first, then call a new SECURITY DEFINER RPC `create_appointment_invoice(appointment_id)` that runs the current invoice logic filtered to non-treatment services, and remove the auto trigger — or keep trigger but early-return when services array is all treatments.

- **Completion side** (`complete_therapy_session` RPC, migration): after marking the session completed, find the patient's latest `unpaid` invoice dated today for that clinic; if found, append a line item for the therapy service (name, amount from session.amount, GST from invoice_services); if not, create a new unpaid invoice with just this line. Recompute subtotal/gst/total/outstanding. Skip if amount is 0.

## 4. Consultation vs treatment slot rules
Currently `BookAppointmentModal` marks a slot "taken" if any appointment exists at that time. Change slot availability + booking guard:
- Determine appointment kind from selected services: if any selected service is `service_type='consultation'` (or none selected → default consultation), treat as consultation.
- Load today's appointments joined with `appointment_services` to know their kind.
- A slot is blocked for consultation booking if a consultation already exists at that time. A slot is always available for treatment bookings (multiple treatments allowed at same time). Also block a consultation slot only against consultation-kind existing appts, not treatments.
- Add a server-side re-check just before insert: if booking a consultation and another consultation exists at same doctor/date/time, abort with toast.

## 5. Cancel action on Treatment Board
`TreatmentBoard.tsx` already has `cancelSession`. Ensure the SessionCard shows a visible "Cancel" button for both `not_started` and `in_progress` states (currently only in the in-progress branch based on rg). Add a small outline "Cancel" button in the not-started actions row, with the same confirm prompt. Completed sessions stay non-cancellable.

## Technical section

### Migrations
1. Update `auto_create_invoice_on_appointment` trigger function: early return when the appointment's linked services (via `appointment_services` + `invoice_services.service_type`) are all `'treatment'`. If no services linked (default consultation flow), keep current behavior.
2. Update `complete_therapy_session` RPC: append/create invoice line as described. Reuse `line_items` JSONB update pattern from the existing trigger.

### Frontend
- `SalesPatientDetail.tsx`: pass `patientId` + `treatmentEnabled` into `ClinicalNotesTab`; render New Plan button.
- `BookAppointmentModal.tsx`: 
  - Fetch `appointment_services` for the day's appointments to classify consultation vs treatment.
  - Slot-taken logic per kind.
  - Order of operations on submit: insert appointment (without triggering invoice yet is not possible — trigger fires on insert). Simplest: keep insert as-is, then if all selected services are treatments, delete the auto-generated invoice for this appointment (`DELETE FROM invoices WHERE appointment_id = X AND paid_amount = 0`). Do this before inserting `appointment_services`. Cleaner alternative already covered above (trigger checks services). Pick trigger approach so no client-side cleanup race.
  - Pre-insert consultation conflict check.
- `TherapistApp.tsx` and `TreatmentBoard.tsx`: pre-start guard query + disabled state.
- `TreatmentBoard.tsx` SessionCard: add Cancel button for not_started.

### Edge cases
- Treatment session with amount 0 → no invoice mutation.
- Multiple treatments completed same day → append multiple line items to same open invoice.
- Rescheduled appointments already skip auto-invoice; keep that behavior.
