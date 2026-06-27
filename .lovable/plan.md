## Problem

**Issue 1 — Filter shows only Current:**
The patient list in `src/pages/Sales.tsx` (`LeadList`) fetches patients with `.limit(1000)` and filters by status **client-side**. The DB has **12,615 current** patients vs. only ~13 in other statuses, so the 1000-row window is 100% "current" — clicking Attempt 1/2/3/Closed returns nothing because those rows are never fetched. Counts in the filter pills are also wrong (computed from the same 1000-row slice).

**Issue 2 — Documents not shown on `/patients/:id`:**
Route `/patients/:patientId` mounts `SalesPatientDetail.tsx`, **not** `PatientDetailPage.tsx`. `SalesPatientDetail` loads `patient_documents` but only renders them grouped under each visit row. Documents uploaded at the patient level (no `visit_id`) are bucketed under `_patient` and never displayed. There is no `PatientDocumentsCard` on this page.

## Fix Plan

### 1. Server-side status filtering + counts in `LeadList` (`src/pages/Sales.tsx`)

- Replace the single `.limit(1000)` query with a query that applies `statusFilter` server-side:
  - When `statusFilter !== "all"` and no search term → `.eq("lead_status", statusFilter)`.
  - When search term is present → keep current behavior (search overrides status), still capped but using `.or(name/phone/email ilike)` server-side so we don't depend on a windowed slice.
- Re-run the query when `statusFilter` / `search` / date range changes (add to the `useEffect` deps).
- Compute pill **counts** from a separate lightweight query: one `count: "exact", head: true` per status (run in parallel with `Promise.all`) filtered by `clinic_id` (and date range when set). Cache so it only re-runs when `clinicId` / date range changes, not on every filter click.
- Drop client-side `statusFilter` predicate from the `filtered` memo (server already filtered).
- Keep source / date / search client-side filters on the fetched window.

### 2. Show patient-level Documents on `/patients/:id` (`src/pages/SalesPatientDetail.tsx`)

- Import `PatientDocumentsCard` from `@/components/patient/PatientDocumentsCard`.
- Render it once in the General / Overview tab (above or below "Medical History"), passing `patientId` and `clinicId`.
- Leave the existing per-visit document chips in the Visits tab unchanged — that's a different surface.

## Out of scope

- No schema changes, no migrations.
- No changes to `PatientDetailPage.tsx` (unused for this route) or to `ConsultPatients`.
- Edit-patient form, invoice flows, WhatsApp — unchanged.

## Verification

1. Open `/patients` → default shows Current with correct count.
2. Click Attempt 1 → list refetches and shows the 10 attempt1 rows; count badge matches.
3. Click Closed → shows the 1 closed row.
4. Click All → paginated list across all statuses.
5. Search "name" → returns matches across all statuses regardless of pill.
6. Open `/patients/<id>` → "Documents" card visible in the General/Overview section; Upload works; uploaded files appear immediately.
