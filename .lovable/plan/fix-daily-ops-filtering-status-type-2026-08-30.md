# Fix Daily Ops filtering (status × type)

The Status and Type dropdowns on Daily Ops → Call task don't combine correctly. Confirmed in `src/pages/CallTaskPage.tsx`:

- **"Done today" ignores the Type filter.** The done group always renders the full `doneCalls` list from `call_logs`, so choosing "Care Call" or "Lead Call" with "Done today" still shows every logged call. Its count (`groupCount("done") = doneCalls.length`) has the same problem.
- **Care and cancelled calls can never be "done".** `careFor("done")` and `cancelFor("done")` return `[]`, so a care call completed today only appears in the generic done list, not under its own type.
- **Lead rows disappear in "Done today".** The done branch never renders the `CallTask` lead component, so lead calls done today aren't shown as lead rows.
- **The status dropdown counts ignore the Type filter.** "Overdue (n) / Due today (n) / Done today (n)" always count all four types, so the numbers don't match what's on screen once a type is chosen.
- **Empty group headers.** Zero-count groups are hidden only when Status = All; picking a specific status shows a "Overdue — 0" header with nothing under it, and the "Rest of today's tasks are clear" panel can appear next to it.

## What changes

1. **Give every done call a type.** Classify each row of today's `call_logs` into appointment / care / cancelled / lead so the done list can be filtered by the Type dropdown:
   - care calls and cancelled-informed calls already write recognisable note text from this page;
   - appointment-reminder calls are written with an outcome + reminder note;
   - everything else falls back to lead.
   To make this reliable going forward, each of the four log paths will also write a short machine tag at the front of the note (e.g. `[type:care]`), stripped before display. Existing rows keep using the text heuristic.
2. **Filter the done group by type** using that classification, and compute the done count the same way.
3. **Filter the status counts by type** — Overdue / Due today / Done today counts in the dropdown reflect the currently selected type.
4. **Render lead rows in the done group** by passing `statusFilter="done"` to the lead `CallTask` component when Type is All or Lead (leads already report their done rows).
5. **Hide empty groups always**, not just under "All", and show the dashed "Rest of today's tasks are clear" panel only when the whole filtered set is empty.

## Technical notes

- Files: `src/pages/CallTaskPage.tsx` (classification helper, `apptsFor`/`careFor`/`cancelFor`/done filtering, count functions, group rendering) and `src/pages/Sales.tsx` only where the lead `CallTask` needs to honour a `done` status filter and where the lead call log note gets its type tag.
- No schema, RPC, route or RLS changes; note tags are plain text prefixes in the existing `call_logs.notes` column.
- Row appearance stays exactly as it is now — this is filtering behaviour only.
