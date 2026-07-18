## Problem

On `/tasks/call-task?status=done`, the "Done Today: 3" pill shows the correct count (from `call_logs` today across all sources), but the body shows nothing.

Why: each sub-tab (Appt Tomorrow / Care / Cancelled / Lead) filters its own list by `statusTab`. When `statusTab === "done"`:
- `appt` shows only tomorrow's appointments already called — usually empty.
- `care` explicitly returns `false` for `done` (done rows are excluded by the query).
- `cancel` requires an "informed" marker on the same row.
- `lead` (the default tab on this URL) delegates to `<CallTask statusFilter="done">`, which filters by `lead_status`, not today's `call_logs` — so today's care/appt/cancel calls never appear.

Today's 3 real `call_logs` entries are only reachable via the "Completed Calls Today" side sheet.

## Fix — frontend only, in `src/pages/CallTaskPage.tsx`

1. When `statusTab === "done"`, render one unified "Done Today" card built from the already-loaded `doneCalls`, and hide the sub-tabs + the four `activeTab === ...` sections.
2. Each row shows: patient name (`PatientLink`), outcome badge, caller name, time (`h:mm a`), and notes with the `[outcome]` / `[informed:...]` prefix stripped. Empty state: "No calls logged today yet".
3. Extend `outcomeStyle` / `outcomeLabel` to cover `doing_well`, `needs_follow_up`, `confirmed`, `rescheduled`, `cancelled`, `rebooked`, `informed`, `not_interested` (existing outcomes unchanged).
4. Leave the side sheet as-is for when `statusTab !== "done"`.

No data-loading or SQL changes; `doneCalls` is already populated by `loadAll` with `patient` and `caller_name`.
