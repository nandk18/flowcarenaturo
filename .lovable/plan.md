# Doctor Schedule Feature — Implementation Plan

Tables `doctor_schedules` and `doctor_exceptions` already exist. No schema migrations needed unless a column is missing (will verify before coding).

## 1. Shared slot utility — `src/lib/scheduleSlots.ts`
- `generateSlots({ schedule, exceptions, appointments, date })` returns `Array<{ time, available, appointment, session: "morning"|"evening"|"single" }>`.
- Honors `is_active`, day-of-week, sessions JSONB, `slot_duration_minutes`, exceptions, booked appointments (status ≠ cancelled), and past-time filtering for today.
- Helper: `getDaySummary` → `available | partial | full | off | past` for calendar colouring.

## 2. Settings → Doctor Schedule (`/settings/doctor-schedule`)
- Add nav item in `SettingsShell` CLINIC group (calendar icon, lucide `CalendarClock`).
- New page `src/pages/settings/DoctorSchedulePage.tsx` mounted via existing `/settings/:section` switch in `Settings.tsx` (add case `doctor-schedule`).
- Top bar: doctor dropdown (from `doctors` table for clinic), Add Exception + Save Schedule buttons.
- 7-day rows with Available toggle, multi-session start/end pickers, add/remove session, per-day slot duration (10/15/20/30/45/60, default 15).
- Save: upsert one row per `(doctor_id, day_of_week)` into `doctor_schedules` with sessions JSONB.
- Exceptions section:
  - Table of existing rows (date / type badge / reason / affects / delete).
  - Add Exception modal (date ≤ today+3mo, type, reason, affects toggle).
  - On save: if affects=true, query conflicting appointments. If any exist, show conflict modal listing patient + time + phone with "Cancel & Go Back" / "Confirm & Cancel Appointments". Confirming updates those appointments to `cancelled` with note, then shows call-list panel with WhatsApp links, "Mark as Called" checkboxes, and CSV export.

## 3. Consult booking — slot-aware picker
- Update `src/pages/AppointmentsPage.tsx` book dialog:
  - On doctor + date change, fetch that doctor's schedule row for the weekday + any exception for the date + same-day appointments.
  - Replace free time `Select` with slot grid grouped by session (Morning/Evening), pills: available (clickable), booked (disabled, gray), selected (highlighted).
  - If exception present: banner "Doctor not available on this date", picker disabled.
  - If no schedule: warning with link to Settings → Doctor Schedule.
  - Duration defaults from `slot_duration_minutes`; user can override via existing Duration select.

## 4. Consult → Availability (`/consult/availability`)
- Add nav item in `ConsultShell` (`CalendarRange` icon).
- New page `src/pages/AvailabilityPage.tsx`:
  - Top bar: doctor dropdown, month nav, Book Appointment button.
  - Month grid coloured green/amber/red/gray/light-gray via `getDaySummary`.
  - Click day → right-side panel with Morning / Evening groups, each slot showing Available or Booked + patient name. Booked → open `/consult/patients/:id` in new tab. Available → open booking dialog prefilled.
  - Tab "Search availability": doctor + date range + N (5/10/20) → list of next N free slots with Book button (prefills form).
- Route added in `src/App.tsx` inside the DashboardLayout block.

## 5. Walk-in booking on Queue
- In `src/components/receptionist/TodayQueue.tsx`, add "Walk-in Appointment" button.
- Opens booking dialog with `date` locked to today, today's slot grid only.
- On save: create appointment (existing flow already promotes lead_status to current) + insert a `visits` row using next token (mirrors current `convertToVisit` logic). Toast with token #.

## Verification
- `bunx tsc --noEmit` after each part.
- Manually click through: Settings → save schedule → exception with conflicts → booking dialog shows correct slots → Availability month + day panel → walk-in adds to queue.

## Notes / assumptions
- "Doctor selector" pulls from `doctors` table (clinic-scoped), not `profiles`, because appointments reference `doctor_id` from `doctors`. Confirm if you'd prefer `profiles` filtered to doctor role.
- Exceptions limited to today + 3 months as specified.
- No new tables, RLS, or edge functions required.
