## Plan — Care Call, Cancel Flow, Templates, Sidebar

Schema already in place: `appointments.care_call_required/done/due_date` and `call_logs.source` exist. No migration needed for those. I will add new template types via the seed RPC + UI.

### 1. Migration (single migration)
- Update `seed_default_message_templates(p_clinic_id)` to also seed `care_call` and `appointment_cancelled_notice`.
- Backfill: call the seed for all existing clinics so the new templates appear immediately in Settings.

### 2. `src/lib/messageTemplates.ts`
- Add `care_call` and `appointment_cancelled_notice` to `MessageTemplateType`, `TEMPLATE_META`, `DEFAULT_BODIES` (vars include `{reason}`, `{appointment_date}`, `{appointment_time}` for cancellation; `{patient_name}`, `{clinic_name}` for care call).

### 3. Care call helper `src/lib/careCall.ts`
- `checkAndSetCareCall(appointmentId, patientId, clinicId, completedDate)` exactly per spec (count first-ever appt, look for follow-up in 2 days, set `care_call_required=true` + due date = completed+2).
- Call site: wherever an appointment is marked completed. Search the codebase for `status: 'completed'` / `.update({ status: "completed"` on appointments and invoke the helper.

### 4. Care Call page `src/pages/CareCallPage.tsx` + route `/tasks/care-call`
- Two sections: Overdue (red) vs Due Today/Upcoming (amber), sorted by due date asc.
- Stats bar: Overdue / Due / Completed Today (today = appointments with care_call_done set today — track via `updated_at` of completed care calls; simplest: count rows where care_call_done=true and updated_at::date=today).
- Per row: patient link, phone + WhatsApp icon (uses `care_call` template), appt completed date, doctor, days since, due date, note textarea, "Mark Called" → insert contact_note (if note) + update appointments.care_call_done=true. Persist draft notes via `formStorage`.

### 5. Cancel appointment flow
- New shared component `src/components/appointments/CancelAppointmentModal.tsx`:
  - Step 1: reason dropdown + notes textarea; Keep/Cancel buttons.
  - On confirm: update appointment status='cancelled' + notes; cancel linked UNPAID invoice; insert call_logs row with `source='appointment_cancelled'`; set `patients.call_due_date = today`.
  - Step 2: result modal — patient name link, phone (click-to-copy), WhatsApp button using `appointment_cancelled_notice` template, Done closes.
- Mount in:
  - `AvailabilityPage` booked slot detail
  - Patient profile Appointments tab (`SalesPatientDetail` appointments rows)
  - Dashboard Today's Consultations widget (`TodayAppointmentsWidget`)
- Calendar styling: cancelled slot → red bg, line-through patient name, "Cancelled" badge, not clickable to rebook (slot becomes free for new booking).

### 6. Call Task page additions (`CallTaskPage.tsx`)
- New "Cancelled Appointments" section (red header) below Tomorrow.
- Source: `call_logs` where `source='appointment_cancelled'` and `called_at >= today-7d`.
- Row: badge, patient link, phone + WhatsApp (cancellation template), cancelled date, reason (from notes), inline note, "Mark Informed" → inserts contact_note, marks local state "Informed ✓", auto-hides after 24h via `informed_at` stored as a new `call_logs.notes` suffix (simplest: track in-component via localStorage keyed by log id with timestamp, hide if >24h old since informed).

### 7. Sidebar
- Find sidebar component, add Care Call entry between Call Task and Opening Checklist with heart-handshake icon and a red count badge (poll every 60s) of pending care calls for current clinic.

### 8. Verification
- Typecheck via `tsgo`.
- Quick Playwright smoke is optional given scope; rely on build success and targeted reads.

### Notes / trade-offs
- `call_logs.source` already exists; reusing as spec'd.
- "Completed Today" stat uses `appointments.updated_at::date = today AND care_call_done=true` (no separate timestamp column).
- "Cancelled appointments" auto-remove after 24h uses an `informed_at` marker stored in `call_logs.notes` (prefix `[informed:<iso>] `) — no schema change.
- All grants/RLS already exist on these tables.
