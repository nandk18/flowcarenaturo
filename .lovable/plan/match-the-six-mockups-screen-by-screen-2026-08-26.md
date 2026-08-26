# Match the six mockups, screen by screen

Presentation-layer redesign of five screens so they follow the uploaded HTML mockups exactly (same layout, density, order of elements). The design tokens from the mockups (canvas `#FBFBFA`, teal `#0E9A80`, blue `#2F6FED`/`#1D4ED8`, status tints, 10px radius, Inter) are already in the theme, so every screen reuses them — no new hex values in components.

Note on item 6: the last point names the patient list but links the patient-profile mockup, so I'm treating it as the patient profile page (item 5 already covers the list).

## 1. Analytics (`flowcare-analytics-redesign.html`) — stays under Settings > Analytics

- Rebuild `AnalyticsView` to the mockup: page title row, period segmented control, 5-across KPI tile grid with label / trend chip / big value / sub-line, then the section cards (revenue, follow-up funnel, treatment packages, leads) in the mockup's order and card styling.
- Keep the existing tabs (Clinic Analytics / Invoice Analytics) and the PIN gate on `SettingsAnalyticsPage` — only the inner content is restyled.
- Leads tab keeps its current data (all sources incl. zero rows, pipeline groups) but adopts the mockup's card/table look.
- No RPC or query changes; same numbers, new presentation.

## 2. Calendar (`flowcare-calendar-redesign.html`) — multi-doctor

- Replace the single-doctor `Select` in `AvailabilityPage` with the mockup's multi-select doctor dropdown (checkbox per doctor + colour avatar, "All doctors" label), Day/Week/Month segmented control, and prev / date / next nav cluster.
- Day view becomes a time-grid with one column per selected doctor (time gutter + per-doctor header showing avatar, name, appointment count); week and month views colour blocks by type with the legend row (Consultation / Treatment / Break), switchable to colour-by-doctor legend.
- Appointment fetching changes from one doctor to the set of selected doctors; the appointment detail dialog, booking, reschedule, cancel and WhatsApp actions stay exactly as they are.
- Selected doctors persist in the URL like the current `?doctor=` param (comma-separated).

## 3. Daily Ops (`flowcare-daily-ops-redesign.html`)

- `TasksPage`: title + subtitle, segmented "Call task / To do list" switch instead of the current tab strip.
- Call task panel: a status dropdown (overdue / due today / done today, with counts), a "Type" filter dropdown, grouped task lists with a group header ("Overdue — 2"), each row a card with type icon, name + phone, red/amber sub-line, and the Call / WhatsApp action buttons on the right; the tidy empty state at the end.
- To do panel: type + priority filter dropdowns, "Add task" primary button on the right, and three cards — High priority, Medium & low, Completed today — each with count and "Nothing here" empty text.
- All existing task data, actions and mutations are preserved.

## 4. Clinical dashboard (`flowcare-dashboard-redesign.html`)

- `AdminDashboard`: page title + subtitle, three KPI tiles (Today's appointments / Completed / Pending) with trend chip and sub-line, then the two-level sub-tab strip — Consultations | Treatments, and inside it Active | Completed — over the appointment rows.
- Rows restyled to the mockup card row (time, patient, service chips, status pill, action buttons); existing start/complete/cancel/reschedule logic untouched.

## 5. Patient list (`flowcare-patient-list-redesign.html`)

- Simplify `LeadList` (used by `PatientsListPage`) to the mockup: title + "N patients on record" subtitle, status filter chips with counts (All / Current / Closed / Lapsed), a "More filters" popover (lead source, added-on date range), a single search input toolbar, and a plain 4-column table — Name, Phone, Status pill, row action menu.
- Keep current row navigation, edit action and the search empty state behaviour.

## 6. Patient profile (`flowcare-patient-profile-redesign.html`)

- `PatientDetailPage`: header card (avatar, name, phone/age/gender meta, status pill, action buttons), underline tab strip — General, Clinical notes, Invoices, Appointments, Treatment — and the General tab's two-column info grid with label/value rows as in the mockup.
- Tab contents keep their existing components, just wrapped in the mockup's card and header styling; mobile stays scrollable.

## Technical notes

- Only presentation files change: `AnalyticsView`, `KpiCard`, `AvailabilityPage`, `TasksPage`/`CallTaskPage`/`TodoListPage`, `AdminDashboard`, `Sales.tsx` (`LeadList`), `PatientDetailPage`, plus small shared UI primitives if a variant is missing (e.g. filter chip, segmented control, stat chip).
- Colours only through the existing semantic tokens; no literal Tailwind colour classes.
- Exception: the calendar needs its appointment query widened from one doctor to many — the only data-layer change in this plan.
- No routes, RPCs, migrations or business logic change.
