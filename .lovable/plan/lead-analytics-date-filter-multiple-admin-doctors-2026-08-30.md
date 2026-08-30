# Lead analytics date filter + multiple admin doctors

## 1. Leads analytics ignores the selected period

Confirmed cause: the current `analytics_leads` function (last updated in migration `20260821071235`) has no date filter left in it. The lead-source/conversion query counts every lead of the clinic regardless of `p_from`/`p_to`, and the pipeline list pulls all attempt/closed/lapsed leads. So Today / Week / Month / Year all return identical numbers.

Fix (database function update, no schema change):
- Re-apply the range filter on the leads aggregate used for **New leads**, **Conversion rate** and **Lead source** (`created_at` in clinic timezone between `p_from` and `p_to`).
- Keep the KPI cards that are by definition "current state" unfiltered: leads in progress and overdue attempts.
- Pipeline list: return leads created in range, plus any still-open attempt1/2/3 leads (so the working queue never disappears when a short range is picked).
- Lead source donut keeps showing all known sources; zero-count sources still render (the merge already happens in the UI), so a filtered period shows real zeros instead of stale totals.

## 2. Custom date range

- Add a `Custom` option after `This Year` in the analytics range selector.
- Choosing it reveals two date inputs (from / to) in the toolbar; the analytics reload uses those dates directly.
- Applies to every analytics view (Overview, Revenue, Patients, Appointments, Leads, Treatments, Therapists) and to the CSV export header, since they all share one range state.

## 3. Multiple doctors per clinic with admin access

Today the invite flow offers admin / doctor / receptionist. A `doctor` role user is not an admin, and only the `admin` invite creates no doctor record — so a clinic can't easily have several full-access doctors.

Changes:
- Invite Staff gets a role option **Doctor (full admin access)**. It creates the profile with `role = 'admin'`, adds the `admin` entry in `user_roles`, and also inserts a `doctors` row for that user in the clinic (name from the invite, editable later).
- Existing users invited this way are upgraded the same way without duplicating their doctors row.
- Settings > Team shows these members as "Doctor · Admin" and keeps the existing edit dialog for name, qualification, specialty and registration number.
- Settings > Doctor Profile keeps editing the signed-in user's own doctor record; admins additionally get a doctor picker so any clinic doctor's details and signature can be maintained.

Calendar, appointment booking, doctor schedules and availability already query all `doctors` rows for the clinic, so every new doctor appears automatically in:
- Availability calendar columns and the doctor multi-select
- Book Appointment doctor dropdown
- Doctor schedule / exceptions settings

## Technical notes

- `supabase/migrations` — new migration replacing `public.analytics_leads` with the range-aware version (security definer, same signature and JSON shape, so no frontend contract change).
- `src/lib/analytics/format.ts` — add `Custom` to `RANGES` and let `dateRange` accept explicit from/to.
- `src/components/analytics/AnalyticsView.tsx` — custom range state + date inputs in the toolbar.
- `supabase/functions/invite-staff/index.ts` — accept `doctor_admin` role: profile role `admin`, `user_roles` admin, plus a `doctors` row.
- `src/pages/Settings.tsx` — new invite option, role labels, and an admin doctor picker for the doctor-profile card.
