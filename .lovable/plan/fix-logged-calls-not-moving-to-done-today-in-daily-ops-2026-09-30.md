# Fix: logged calls not moving to "Done today" in Daily Ops

## What's happening (confirmed)
Your two calls for Vishnu were saved correctly (02:37 and 02:38 UTC on 30 Sep, outcome "confirmed"). But Daily Ops looks for "today's" calls using a day window with no time zone, so the database reads it as UTC. Your device is still on 29 Sep locally, while the saved time is already 30 Sep in UTC — so the page can't find the call, thinks Vishnu wasn't called, and keeps the row under "Due today". The same thing hits anyone logging calls near midnight UTC (in India, before 5:30 AM).

## Fix
1. Daily Ops call task: build the "today" window from the start and end of the local day, converted to proper UTC timestamps, so a call logged now always counts as done today.
2. Apply the same fix to the lead call list (it uses the same flawed window), so lead calls also move to done.
3. Hide an appointment reminder row immediately after logging (already done in memory) and keep it hidden after the reload.

## Technical notes
- `src/pages/CallTaskPage.tsx` line ~132 and `src/pages/Sales.tsx` line ~1104: replace `today + "T00:00:00"` / `"T23:59:59"` with `startOfDay(new Date()).toISOString()` / `endOfDay(new Date()).toISOString()` (date-fns), memoised alongside `today`.
- No database changes.
