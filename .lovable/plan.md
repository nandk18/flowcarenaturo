# Plan — Relocate UI, Fix Reschedule, Finish Remaining

## 1. Reschedule does not cancel current appointment — FIX

In `RescheduleAppointmentModal.tsx` the old appointment update fires but errors are swallowed, and the order (insert new → update old) means a failure on the update leaves the old row "scheduled". Rewrite the flow as:

1. **UPDATE old appointment FIRST** → `status='cancelled'`, `cancellation_reason='Rescheduled'`, append note, `rescheduled_to` left null for now. Destructure `{ error }` and throw on failure.
2. **INSERT new appointment** with `rescheduled_from = old.id`. Capture id, throw on error.
3. **UPDATE old again** to set `rescheduled_to = new.id` (link the pair).
4. Copy `appointment_services`, re-point active invoice to new appointment id.
5. On any failure after step 1, roll back the old row back to `scheduled` so the user isn't left in a half-cancelled state.

Also: surface specific errors in the toast (`error.message`) and call `onRescheduled()` only on full success.

## 2. Move Patient To-Do card → `SalesPatientDetail.tsx`

- Remove `PatientTodoCard` import + render from `PatientDetailPage.tsx` (line 26 + 411).
- Add `PatientTodoCard` into `SalesPatientDetail.tsx` General tab right column as the last card (matches existing card grid). Patient + clinic ids already available in that page.

## 3. Invoice changes belong in `PatientInvoicesTab.tsx`

- Service picker upgrade (search combobox + chips + running total) that was added to the global invoice flow gets mirrored inside `PatientInvoicesTab.tsx` "Add Service" entry point for the per-patient invoice detail panel.
- Also add the rescheduled-history badge here: when an invoice row is linked to an appointment whose `rescheduled_from` is set, show an amber "Rescheduled" chip + tooltip "Originally <old date/time>".

## 4. Remaining items from prior turn

A. **Reschedule history badge in Patient visits list** — render in `PatientInvoicesTab.tsx` and `SalesPatientDetail.tsx` appointments list: amber `Rescheduled` badge + muted "Originally: <date time>" when `rescheduled_from` set; "Rescheduled →" link when `rescheduled_to` set.

B. **Per-call-type Log Call dropdowns** in `CallTaskPage.tsx`:
   - Lead Call → Confirmed Visit / Interested-Follow Up / Not Interested / No Answer / Wrong Number
   - Appointment Tomorrow → Confirmed / Rescheduled / Cancelled / No Answer
   - Care Call → Doing Well / Needs Follow-up / No Answer
   - Cancelled Call → Rebooked / Not Interested / No Answer
   Each outcome writes the matching row to `call_logs` and updates patient/appointment status where relevant.

C. **TodoListPage filter tabs** — add `[All / Patient Tasks / General Tasks]` tab strip, plus optional patient search field in the Add Task modal that sets `patient_id`. Patient-linked rows show the existing teal "For: <Patient> →" chip already wired.

## Technical notes

```ts
// Reschedule, new order
const { error: e1 } = await supabase.from("appointments")
  .update({ status: "cancelled", cancellation_reason: "Rescheduled", notes: oldNote })
  .eq("id", appointment.id);
if (e1) throw e1;

const { data: newAppt, error: e2 } = await supabase.from("appointments")
  .insert({ ...copy, rescheduled_from: appointment.id }).select("id").single();
if (e2) {
  // rollback
  await supabase.from("appointments").update({ status: old.status, cancellation_reason: null }).eq("id", appointment.id);
  throw e2;
}

await supabase.from("appointments").update({ rescheduled_to: newAppt.id }).eq("id", appointment.id);
```

No DB migration needed — all columns/triggers from the previous migration are already in place.

## Files touched

- `src/components/appointments/RescheduleAppointmentModal.tsx`
- `src/pages/PatientDetailPage.tsx` (remove todo card)
- `src/pages/SalesPatientDetail.tsx` (add todo card + reschedule badges)
- `src/components/billing/PatientInvoicesTab.tsx` (service search + reschedule badge)
- `src/pages/CallTaskPage.tsx` (per-type outcome dropdowns)
- `src/pages/TodoListPage.tsx` (filter tabs + patient picker in add modal)

Approve and I'll implement straight through.
