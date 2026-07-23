
## Changes

### 1. Overdue Calls KPI
Add a metric counting `call_logs` (or `patient_idle_log` / care call tasks) where the scheduled/due date is in the past and status is still pending (not `done`/`completed`).
- Extend `analytics_patients` (or add a lightweight `analytics_operations` RPC) to return `overdue_calls` count for the clinic.
- Surface as a KPI card in `AnalyticsView.tsx` (Overview tab).

### 2. Overdue To-Do KPI
Count `todo_list` rows where `is_done = false` AND `due_date < today`, scoped to clinic (and optionally date-range independent since overdue is a "current state" number).
- Include `overdue_todos` in the same RPC.
- Surface as a KPI card next to Overdue Calls.

### 3. CSV Rupee Symbol Fix
`‚Çπ` is the classic UTF-8 → Windows-1252 mis-decoding of `₹`. Fix in `src/lib/analytics/format.ts` → `downloadCSV`:
- Prepend UTF-8 BOM (`\uFEFF`) to the Blob content so Excel opens it as UTF-8.
- Keep the `text/csv;charset=utf-8` MIME type.

## Technical details

- **New RPC** `analytics_overdue_counts(p_clinic_id uuid)` returning `{ overdue_calls int, overdue_todos int }`, SECURITY DEFINER with the same clinic-access guard used by other analytics RPCs. Verify exact tables/columns first — need to confirm which table holds care-call due dates (`call_logs` vs `patient_idle_log`) and its status column before writing the SQL.
- **Client**: add `fetchOverdueCounts` in `src/lib/analytics/api.ts`; render two KPI cards in the Overview section of `AnalyticsView.tsx`; also include both in the Super Admin per-clinic leaderboard row if trivial (optional, confirm).
- **CSV fix**: single-line change in `downloadCSV` — `new Blob(["\uFEFF" + csv], ...)`.

## Out of scope
- No changes to how todos or calls are created/completed.
- No date-range filtering on the overdue counts (they represent "right now").
