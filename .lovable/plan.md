
## Goal

1. Let admins/staff edit clinical notes from the Patient page (not just under `/consult/`).
2. Give therapists a read-only view of a patient's clinical notes (summary) from the Therapist App.
3. Show each therapist an analytics widget of patients seen today and this week.

---

## 1) Editable clinical notes on Patient page

**File:** `src/pages/SalesPatientDetail.tsx`
- Currently `editable={fromConsult}` on `ClinicalNotesTab` gates editing to `/consult/*` only, and the footer shows "Read-only view. Editing happens in Consult."
- Change gating so any authenticated staff (admin/doctor/receptionist) on this patient page can edit:
  - Pass `editable={true}` (or `editable={fromConsult || hasStaffRole}`) so the existing "Edit note" button (`editable && editVisit && (firstNote || firstRx)`) is visible.
  - Remove/replace the "Read-only view. Editing happens in Consult." footer.
- Reuse the existing `EditVisitSheet` — no new editor needed. Saves go through the same clinical_notes update path already used by Consult, so RLS on `clinical_notes` continues to apply.
- If a visit has no clinical note yet, add an "Add note" button that opens `EditVisitSheet` with a blank note (small extension to the sheet's initial state).

## 2) Patient summary for Therapists

**File:** `src/pages/TherapistApp.tsx` (+ small new component)
- On each session card, add a "View summary" button that opens a bottom-sheet/dialog showing the most recent clinical note for that patient:
  - Chief complaint, latest SOAP note fields, allergies/chronic conditions from `patients`.
  - Read-only. Therapists cannot edit.
- Data fetch: single query to `visits` (latest) joined with `clinical_notes` and `patients` allergy/chronic fields, filtered by `patient_id`.
- RLS: the therapist is signed in as the clinic admin session (per `useAuth`), so existing `clinical_notes` SELECT policies already permit read within the clinic. No policy changes needed. If read blocked, add a dedicated `get_patient_summary_for_therapist(p_patient_id)` SECURITY DEFINER RPC scoped to the caller's clinic.

## 3) Therapist analytics (today / this week)

**File:** `src/pages/TherapistApp.tsx`
- Add a compact stats strip above the sessions list showing for the signed-in therapist:
  - **Today:** count of distinct patients with `therapy_sessions.status = 'completed'` and `session_date = today` where `therapist_id = me`.
  - **This week:** same, `session_date` between Monday–Sunday of current week.
  - **Total sessions today** (not just distinct patients).
- Implemented client-side with two lightweight `supabase.from('therapy_sessions').select('patient_id, session_date', { count: 'exact' })` queries — no schema change.
- Refresh on the same realtime channel already subscribed for `therapy_sessions`.

## Out of scope
- No changes to the Consult workflow.
- No changes to RLS unless step 2's read is blocked in practice.
- No new tables.
