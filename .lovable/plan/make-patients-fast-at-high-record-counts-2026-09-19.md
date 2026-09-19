# Make `/patients` fast at high record counts

## Goal
Keep the patient list quick and reliable as clinics grow from thousands to substantially larger patient volumes, without changing the page’s visible workflow.

## Verified findings
- `/patients` uses `LeadList` and already requests only 20 patients per page.
- The database currently contains two clinics with more than 6,300 patients each.
- Loading the page triggers seven separate exact-count queries for the status chips, plus another exact count with the page query.
- Database statistics identify clinic-level patient counts as the dominant slow query, averaging roughly 0.3–1.2 seconds per call and reaching about 1.6 seconds.
- Every displayed page also fetches contact notes, although the current patient table does not render those notes.
- Name and phone have search indexes; email substring search does not.

## Implementation
1. **Make the first page lightweight**
   - Fetch only the fields rendered in the patient table and needed by its row actions.
   - Remove the unused contact-note request from normal page loading.
   - Preserve the current 20-row database pagination and URL-based filters.

2. **Replace repeated counts with one database operation**
   - Add a clinic-scoped database function that returns all status totals in one aggregate scan.
   - Validate that the caller belongs to the requested clinic, while retaining Super Admin access.
   - Replace the seven parallel count requests with this single call.
   - Avoid making the visible rows wait for status totals; render the list as soon as its page arrives.

3. **Reduce count overhead for filtered pages**
   - Return the current filtered total efficiently with the page result, instead of issuing a separate expensive exact-count path.
   - Keep accurate “Showing X–Y of Z” text and existing Previous/Next behavior.
   - Correct an out-of-range page automatically if filters reduce the number of results.

4. **Optimize searches and filters**
   - Add the missing email substring-search index.
   - Add only the compound indexes supported by the actual list filters and sort order, avoiding redundant indexes already present.
   - Keep the short search delay so typing does not send a request for every keystroke.

5. **Preserve full exports without slowing the list**
   - Keep CSV/XLSX fetching on demand rather than during page load.
   - Continue batching export-only note retrieval so large exports do not increase normal page latency.

6. **Validate at scale**
   - Compare database execution plans before and after the migration.
   - Verify first load, search, status/source/date filtering, next/previous pages, empty results, and exports.
   - Confirm the app build and runtime logs remain clean.

## Technical scope
- Update the patient-list query flow in `src/pages/Sales.tsx`.
- Add a Supabase migration for the aggregate function and targeted indexes, including explicit execution grants and access checks.
- No visual redesign and no changes to patient records or existing filters.
