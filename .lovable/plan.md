# Fix 4 issues

## 1. Past appointments not visible in calendar (Availability)

**Where:** `src/lib/scheduleSlots.ts` returns `reason: "past"` for any date before today, and `src/pages/AvailabilityPage.tsx` DayView (line 544) short-circuits with "This date is in the past" — hiding the actual appointments that happened that day.

**Fix:** In `AvailabilityPage.tsx` DayView, when `reason === "past"`:
- Still render the list of `activeAppts` (read-only) so users can see who attended.
- Show a small "Past date — read only" banner.
- Skip the "book slot" grid (no new bookings on past dates).

Also mirror this in `WeekView`/`MonthView` if they hide past-day appointments (verify while editing).

## 2. `checklist_logs_checked_by_fkey` foreign key violation

**Root cause:** The FK is `checked_by → auth.users(id)`, but `src/pages/_ChecklistPage.tsx` passes `getProfileId()` which returns `profiles.id` — a different UUID. Insert/update fails.

**Fix:** In `src/pages/_ChecklistPage.tsx` (`toggle` function), replace `const userId = await getProfileId();` with the current auth user id from `supabase.auth.getUser()` (already fetched on line 84 — just use `user?.id` instead of `userId`). Remove the now-unused `getProfileId` import.

## 3. Call Task not aligned on phone

**Where:** `src/pages/CallTaskPage.tsx`.

**Fixes for narrow viewports:**
- Status pills row (~line 376): pills wrap oddly and overflow — change to `flex gap-2 overflow-x-auto -mx-4 px-4 pb-1` with `shrink-0` on each button, keeping wrap on ≥sm.
- Tabs list (line 399): `grid-cols-2 sm:grid-cols-4` stacks labels into 2 rows. Switch to a single horizontally scrollable row on mobile (`flex overflow-x-auto` with `sm:grid sm:grid-cols-4`), each `TabsTrigger` `shrink-0 whitespace-nowrap`.
- Ensure row cards inside each tab use `flex-wrap` on action buttons so the "WhatsApp / Called / Skip" cluster doesn't overflow.

## 4. Patient profile tabs not aligned + invoice list doesn't scroll horizontally

**Where:** `src/pages/SalesPatientDetail.tsx` line 573 uses `TabsList grid w-full max-w-2xl grid-cols-5` — on 390px screens the 5 tabs are crushed and text is truncated.

**Fix:**
- Replace with a horizontally-scrollable row on mobile: `flex w-full overflow-x-auto gap-1 sm:grid sm:grid-cols-5 sm:max-w-2xl`, and give each `TabsTrigger` `shrink-0 whitespace-nowrap px-3`.
- In the invoice tab (`src/components/billing/PatientInvoicesTab.tsx`), the invoice detail table at line 490 (`rounded-lg border overflow-hidden`) hides horizontal overflow. Wrap the `<Table>` in `<div className="overflow-x-auto">` and change the parent to `overflow-hidden rounded-lg border` on the outer wrapper only so the inner scrolls. Ensure the invoice cards list container also allows horizontal scroll where table columns exceed viewport.

## Verification
- Open a past date in Availability → see appointment list with read-only banner.
- Toggle a checklist item → row appears in `checklist_logs` with no FK error.
- Resize to 390px: Call Task pills+tabs and Patient tabs scroll horizontally cleanly.
- Patient → Invoices tab → invoice detail scrolls right-to-left when columns exceed width.

## Technical notes
- No schema changes. Only frontend edits + one auth-id swap.
- Files touched: `src/pages/AvailabilityPage.tsx`, `src/pages/_ChecklistPage.tsx`, `src/pages/CallTaskPage.tsx`, `src/pages/SalesPatientDetail.tsx`, `src/components/billing/PatientInvoicesTab.tsx`.
