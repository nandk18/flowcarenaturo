# Daily Ops page + Leads tab in Analytics

Two changes based on the uploaded mockups. Both are presentation-layer work on top of existing data.

## 1. Tasks page becomes "Daily Ops" (flowcare-daily-ops mockup)

Rename and restyle the combined Call Task / To Do page to match the mockup, keeping all current logic.

- Page header: "Daily Ops" with the sub-line "Everything front desk needs to clear today — calls and to-dos, in one place", plus the thin gradient wave divider.
- Two main tabs styled as in the mockup: **Calls** (with an urgent red count) and **To-Dos** (with a count). Sidebar group renamed from "Tasks" to "Daily Ops"; the item label becomes "Daily Ops" with the same badge.
- Calls panel:
  - A status row of three pills — Overdue / Due Today / Done Today — with counts. These become clickable filters (Overdue selected by default) applied on top of the existing lists.
  - The existing type tabs (Appointment Tomorrow, Care Call, Cancelled Call, Lead Call) become filter chips with count badges, matching the mockup's pill styling.
  - Call rows re-laid out as: attempt badge + name on the left, phone underneath, an overdue/due label, an inline note box, and Log Call / Skip buttons on the right. Existing log-call behaviour, outcomes and skip logic unchanged. Stays stacked and readable on mobile.
- To-Dos panel: filter chips and "Add Task" in one toolbar, then three columns — High Priority, Medium & Low, Completed Today — each with a coloured dot, count and "Nothing here" empty state. Task cards show checkbox, text, Patient/General tag and due/completed time.
- Old `/tasks/...` URLs keep working; only labels and layout change.

## 2. New "Leads" tab in Analytics (flowcare-crm mockup)

Add a Leads tab between Overview and Revenue in the analytics view (so it appears in Settings > Analytics and in the super-admin drill-down).

Contents, matching the mockup:

- Four KPI cards: New Leads Today, In Progress (with count overdue on next attempt), Converted in period, Conversion Rate (lead to booked patient).
- "By Source" card: one row per lead source with a proportional bar and "X leads · Y won" plus the conversion percentage.
- Pipeline board: columns for New Lead, Attempt 1, Attempt 2, Attempt 3, and Lapsed/Closed, with per-lead cards showing name, phone, last-attempt/logged time and an overdue or due-date chip. Cards link through to the patient's Sales detail page.
- Leads data is included in the existing "Export CSV" output.

Note on data: `lead_source` is empty for almost every existing patient, so the By Source card will mostly show an "Unknown" row until sources are captured at lead creation. Everything else (statuses, call due dates, attempts) is already populated.

## Technical notes

- New RPC `analytics_leads(p_clinic_id, p_from, p_to)` (security definer, same `_analytics_can_access` guard as the other analytics functions) returning: totals (new today, in progress, overdue attempts, converted in range, conversion rate), a by-source breakdown, and the pipeline rows grouped by `lead_status`. Exposed via `src/lib/analytics/api.ts` as `fetchLeads`.
- "Converted" = a patient whose `lead_status` is `current` and who has at least one appointment; leads = patients whose `lead_status` is not null.
- `AnalyticsView.tsx`: new `leads` tab, KPI cards reuse `KpiCard`, source bars and pipeline columns as plain Tailwind (semantic tokens only).
- `TasksPage.tsx`, `CallTaskPage.tsx`, `TodoListPage.tsx`, `MainShell.tsx`: layout/label changes only; the call-status pill filter is local component state.
