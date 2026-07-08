## Plan

1. **Make individual session creation visible immediately**
   - Update the treatment booking/start flow to use the shared `createTherapySession` utility wherever treatment sessions are created.
   - This ensures individual fallback plans are created with a valid `treatment_plan_item` and linked `therapy_session` consistently.

2. **Fix Treatment tab filtering/display**
   - Adjust `PatientTreatmentTab` so individual plans are not hidden when their plan item counters are temporarily stale or inconsistent.
   - Show progress using plan-item counters plus linked session data as a fallback, so individual sessions show as `0/1`, scheduled, or `1/1 done` instead of disappearing or showing `0/0`.

3. **Prevent duplicate individual plans**
   - Keep using existing active plan items for the same service first.
   - Only create an `Individual - Service` plan when no existing plan item has remaining capacity and no same-day session already exists.

4. **Migrate remaining direct session creation points**
   - Update `startTreatmentForAppointment` and treatment booking/walk-in paths to call `createTherapySession` instead of inserting `therapy_sessions` directly.
   - Keep appointment status updates and existing treatment-only billing behavior unchanged.

5. **Verify the flow**
   - Check that booking/starting an individual treatment creates one visible plan in the patient Treatment tab.
   - Check that completing it updates progress to `1/1 done` and does not create duplicates.