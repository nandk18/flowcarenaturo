## Root cause (verified)

Sessions created after ~6:30 PM IST get stamped with **tomorrow's UTC date**, but the Clinical Dashboard and Therapist app query by **local date**, so the session becomes invisible everywhere except the Board (which also uses UTC).

Confirmed in code:

- `src/lib/createTherapySession.ts:55` — `params.date ?? new Date().toISOString().split("T")[0]` → **UTC date**
- `src/lib/treatmentStart.ts:57,153` — same `toISOString().split("T")[0]` → **UTC date**
- `src/pages/TreatmentBoard.tsx:73` — `new Date().toISOString().split("T")[0]` → **UTC date** (matches insert, that's why Board shows it)
- `src/pages/AdminDashboard.tsx:103` — `format(new Date(), "yyyy-MM-dd")` → **local date** (misses evening sessions → stuck on "Start Treatment")
- `src/pages/TherapistApp.tsx:56` — `format(new Date(), "yyyy-MM-dd")` → **local date** (misses evening sessions → therapist sees nothing)

The morning works because UTC date == local date until ~18:30 IST.

## Fix

Standardize the entire treatment module on **local `yyyy-MM-dd`** (which is what "today" means to the clinic and what the schedule-picker already uses):

1. `src/lib/createTherapySession.ts` — replace the UTC default with a local-date helper.
2. `src/lib/treatmentStart.ts` — same replacement in `ensureIndividualPlanForServices` and `startTreatmentForAppointment`.
3. `src/pages/TreatmentBoard.tsx` — switch the `today` variable and the "add therapy" `date` argument from UTC to local.
4. Add one shared helper `todayLocalISO()` in `src/lib/utils.ts` and reuse it in the four files above (plus a light audit of other `toISOString().split("T")[0]` call sites in the treatment flow to keep them consistent).

No schema changes, no RLS changes — this is a pure client-side date-normalization fix.

## Verification

- Simulate an evening session by inserting a `therapy_sessions` row with `session_date` = local today and confirm Dashboard flips to "On Board" and Therapist app shows it.
- Re-check that a genuine future-dated session (tomorrow local) still appears only in the Board's "upcoming" list, not today.
