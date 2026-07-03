## Problem

Saving a treatment plan today creates rows in `treatment_plans` and `treatment_plan_items` but never creates any `therapy_sessions`. The Treatment Board only lists rows from `therapy_sessions` for today, so it always shows "No therapy sessions scheduled for today" even though 4 active plans exist.

## Fix — Phase 1 (make the board show sessions)

1. **New RPC `schedule_plan_sessions(p_plan_id uuid, p_date date)`** (SECURITY DEFINER, clinic-scoped)
   - For each `treatment_plan_items` row on the plan with `status='active'` and `sessions_scheduled < total_sessions`:
     - Insert `sessions_per_visit` rows (capped by remaining) into `therapy_sessions` for `p_date` with:
       - `clinic_id`, `patient_id`, `treatment_plan_id`, `treatment_plan_item_id`, `service_id`, `service_name`
       - `status = 'not_started'`, `session_number = sessions_scheduled + n`
       - `therapist_id = null`, `room = null` (assigned later on Therapists page)
     - Increment `sessions_scheduled` on the item accordingly.
   - Idempotent: skip items that already have sessions for `p_date`.

2. **Call it from `TreatmentSchedule.savePlan`** right after inserting plan items, using `startDate`. Toast becomes "Treatment plan created — N sessions scheduled for {date}".

3. **Backfill button on the Board** — small "Schedule today's sessions" action visible when the board is empty but active plans exist for today's date range, calling the RPC per plan. Also runs automatically once on mount for any active plan whose `start_date <= today` and which has no sessions today, so the four existing plans light up without manual work.

## Out of scope (later phases)

- Auto-rolling next day's sessions on completion.
- Therapist/room auto-assignment.
- Capacity enforcement at scheduling time (capacity display already exists).

## Files touched

- New migration: `schedule_plan_sessions` RPC + grant EXECUTE to `authenticated`.
- `src/pages/TreatmentSchedule.tsx` — call RPC after plan insert.
- `src/pages/TreatmentBoard.tsx` — auto-backfill on mount + manual button.
