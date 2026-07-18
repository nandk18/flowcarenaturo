## Current state (verified)

- `src/lib/careCall.ts` already flags care calls, but only for **first-visit** patients with no follow-up within 2 days. Called from consultation/appointment completion paths.
- `care_call_required` / `care_call_due_date` / `care_call_done` live on `appointments`. `CareCallPage.tsx` and `CallTaskPage.tsx` already render any appointment where `care_call_required=true AND care_call_done=false`.
- There is **no** logic that flags returning treatment patients who then disappear. Treatment gaps are invisible to the Care Call list today.

## What to add

A daily "treatment gap" sweep that flags patients who completed a therapy session ≥10 days ago and have nothing (session or appointment) since.

### 1. New RPC `flag_treatment_gap_care_calls(p_clinic_id uuid)`

Security-definer, clinic-scoped. For each patient in the clinic:

1. Find their **latest completed** `therapy_sessions` row (`status='completed'`).
2. Skip if `completed_at > now() - interval '10 days'`.
3. Skip if the patient has any non-cancelled `therapy_sessions` OR non-cancelled `appointments` with a date **after** that last completed session (i.e. they came back or are already scheduled).
4. Skip if any existing appointment for that patient already has `care_call_required=true AND care_call_done=false` (avoid duplicates).
5. Otherwise, mark the **appointment** tied to that last completed session (fallback: most recent appointment for the patient) with:
   - `care_call_required = true`
   - `care_call_due_date = CURRENT_DATE` (overdue-styled after that day, matching existing UI)
   
Returns the number of patients newly flagged.

### 2. Daily schedule via `pg_cron` + `pg_net`

Insert one cron job per clinic is overkill — instead schedule a wrapper `flag_all_treatment_gap_care_calls()` that loops clinics and calls the RPC. Run daily at 08:00 clinic-local (use UTC 02:30 as a safe default; user can tune).

### 3. Manual trigger

Add a small "Refresh gaps" button on `CareCallPage.tsx` that calls the RPC for the current clinic so admins don't have to wait for cron on first rollout / backfill.

### 4. WhatsApp copy

The existing `care_call` template works for both cases. No change unless you want a distinct "we miss you" tone for gaps — can add a `care_call_gap` template later if desired.

## Files touched

- New migration: RPCs `flag_treatment_gap_care_calls`, `flag_all_treatment_gap_care_calls`, and the `cron.schedule(...)` call (via the insert tool since it embeds project URL + anon key).
- `src/pages/CareCallPage.tsx`: add "Refresh gaps" button wired to the RPC.

## Open questions

1. Gap threshold — confirm **10 days** (some clinics use 7).
2. Should the flag be cleared automatically if the patient books/completes something after being flagged? (Recommended: yes — same sweep can set `care_call_done=true` if a newer visit exists.)
