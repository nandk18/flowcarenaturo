# Align 5 screens with the mockups (previews first)

Step 0 — before any code changes, produce a visual reference PNG for each of the five screens (Daily Ops call tasks, Daily Ops to-do, Calendar day/week/month, Patient profile, Analytics) rendered from the uploaded HTML mockups and the attached analytics image, saved to the project files so you can approve the look. Implementation only starts after that.

## 1. Daily Ops — to-do priority filter
When a priority is picked in the dropdown, hide the group cards that don't match (currently the "High priority" / "Medium & low" / "Completed today" headers still render empty). Same for the type filter: only matching groups render, with a single empty state if nothing matches.

## 2. Daily Ops — call task styling
Rework the call-task panel to match `flowcare-daily-ops-redesign.html` exactly: subtle card rows (soft borders, muted sub-lines, small type icon chip), group header with count, and a single status dropdown that includes an "All" option alongside overdue / due today / done today.

## 3. Calendar — exact mockup for all three views
Rebuild `AvailabilityPage` day / week / month bodies to the mockup markup: day = time gutter + one column per selected doctor with header avatar/name/count; week = 7 columns with time rows and coloured blocks; month = 6x7 grid cells with up to 3 event pills and "+N more". Legend row and toolbar spacing as in the mockup. No change to booking, reschedule, cancel or WhatsApp logic.

## 4. Patient profile
Match `flowcare-patient-profile-redesign.html`: header card (avatar, name, meta line, status pill, actions), underline tab strip, and the General tab's two-column label/value grid with the mockup's card padding and dividers. Existing tab content components stay.

## 5. Analytics — match the attached image
Rebuild the top of `AnalyticsView`:
- Title + "Everything the doctor needs to see, in one glance" subtitle.
- Period segmented control (Today / This week / This month / This year / Custom range) plus a "View: Overview" dropdown on the right.
- 5 KPI tiles with left colour rail, label + trend chip, big value, and a small sparkline.
- Three cards below: "Revenue over time" bar chart, "Collected vs outstanding" donut with centre percentage and legend, "Follow-up funnel" horizontal bars (Sent / Booked) with counts.
Data comes from the existing analytics RPCs; sparkline/bar series use the values already returned. Existing tabs and PIN gate unchanged.

## Technical notes
- Presentation-only: `TodoListPage`, `CallTaskPage`, `AvailabilityPage`, `PatientDetailPage`, `AnalyticsView`, plus small shared chart primitives (sparkline, donut, bar) added under `src/components/analytics/`.
- Colours strictly via existing semantic tokens; no literal hex in components.
- No routes, RPCs, migrations or business logic change.
