## Goal

Consolidate Care Call + Cancelled Appointments into the Call Task page, and add a Cancel button on the patient profile's Appointments tab.

## Changes

### 1. `src/pages/CallTaskPage.tsx`
Add two new sections to the existing Call Task page, below the current Tomorrow's Appointments section:

- **Care Call section** (heart-handshake icon, amber/red header)
  - Same query as `CareCallPage`: `appointments` where `care_call_required=true AND care_call_done=false` for this clinic
  - Split visually into Overdue (red) vs Due Today / Upcoming (amber), sorted by `care_call_due_date` asc
  - Each row: patient link, phone + WhatsApp button (using `care_call` template), appointment date, doctor, days since visit, due date, inline note textarea, "Mark Called" button → inserts `contact_notes` row + updates `appointments.care_call_done=true`
  - Section header shows pending count badge

- **Cancelled Appointments section** (red header)
  - Query `call_logs` where `source='appointment_cancelled' AND called_at >= today-7d` for this clinic
  - Rows: red "Cancelled" badge, patient link, phone + WhatsApp (uses `appointment_cancelled_notice` template), cancelled date, reason (parsed from notes), inline note textarea, "Mark Informed" button → inserts `contact_notes` row + tags the `call_logs.notes` with `[informed:<iso>]` prefix so it auto-hides after 24h

Both sections reuse the existing Call Task page layout/cards and respect the `formStorage` draft note pattern already used there.

### 2. Sidebar (`src/components/layout/MainShell.tsx`)
- **Remove** the standalone "Care Call" nav item — it now lives inside Call Task.
- Keep the red count badge logic, but attach it to the existing "Call Task" item (sum of pending care calls + pending cancelled-appointment informs).

### 3. Route cleanup (`src/App.tsx`)
- Keep `/tasks/care-call` route as a redirect to `/tasks/call-task` (so any existing links still work), or remove the route entirely. Default: redirect, since `CareCallPage` becomes unused. Delete `src/pages/CareCallPage.tsx` after moving its logic into shared helpers inside `CallTaskPage.tsx`.

### 4. Patient profile — Appointments tab (`src/pages/PatientDetailPage.tsx`)
- For each appointment row whose `status` is not already `cancelled` or `completed`, add a small red "Cancel" button next to the existing actions.
- Clicking opens the existing `CancelAppointmentModal` with that appointment's data. On success, refresh the appointments list.

### 5. No DB changes
All required columns, enums, templates, and grants already exist.

## Verification
- `tsgo` typecheck.
- Manual: open `/tasks/call-task` → see Care Call and Cancelled sections populated; sidebar shows combined count; open a patient profile → Appointments tab shows Cancel button → modal cancels appointment and creates the call_logs row that then appears in Cancelled Appointments section.
