# Daily Ops label + Leads tab fixes

Three fixes, based on what's in the code and data today.

## 1. Sidebar still says "Call Task & To Do"

The sidebar group was renamed to "Daily Ops" but the item under it still reads "Call Task & To Do". Rename the item label to "Daily Ops" (same route `/tasks/list`, same badge). Since the group and item then carry the same name, drop the redundant group label so the sidebar shows a single "Daily Ops" entry alongside "Pending Invoices".

## 2. Leads by source: always show every source

Right now only sources that actually appear on patients are listed, and `lead_source` is empty for nearly every patient, so the card shows one "Unknown" row. Change it to always render the full set of sources — Instagram, Phone, WhatsApp, YuvaLife, Friend (the values the database allows) — plus "Unknown" when there are unattributed leads, each with its own colour dot, bar, "X leads · Y won" and rate. Sources with zero leads show a 0 row with an empty bar, matching the mockup.

## 3. Pipeline: closed leads missing, and drag-and-drop between columns

Two problems:

- Closed/Lapsed columns are empty because the pipeline only includes closed and lapsed leads created inside the selected date range, and all 44 closed leads were created earlier. Fix: include closed and lapsed leads regardless of creation date (most recent first, capped), so the Closed column reflects reality. Attempt 1/2/3 stay as-is.
- Make lead cards draggable between columns. Dragging a card onto Attempt 1, Attempt 2, Attempt 3, Lapsed or Closed updates that patient's lead status immediately, with the card moving optimistically and a toast on success or failure. Moving into an attempt column also sets the next call-due date the same way the Sales page does; moving to Lapsed/Closed clears it. Clicking (not dragging) a card still opens the patient.

## Technical notes

- `MainShell.tsx`: item label change only.
- `analytics_leads` RPC: drop the date-range condition on the `closed`/`lapsed` branch of the pipeline query; keep the 200-row cap ordered by due date then recency. `by_source` stays as-is — the full source list is filled in on the client from a fixed source list merged with the RPC rows.
- `AnalyticsView.tsx`: fixed `LEAD_SOURCES` array merged with `led.by_source`; pipeline cards get native HTML5 `draggable` with `onDragStart`/`onDragOver`/`onDrop` on the columns, an `UPDATE` on `patients.lead_status` (+ `call_due_date`) via the Supabase client, and local state so the board reorders without a refetch.
