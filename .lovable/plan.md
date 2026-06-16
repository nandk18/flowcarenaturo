
This is a very large restructure spanning navigation, several new pages, a public self-fill flow, PDF generation, bulk import, and a global polish pass. I'll implement it in phases. Please confirm the plan and a few decisions before I start writing code.

## Phase 1 — Shell & navigation
- New `AppShell` with persistent left sidebar (200px) + top bar (logo, global search, notification bell, profile menu). Mobile: hamburger + slide-in overlay.
- Sidebar groups: PATIENTS (List, Add), AVAILABILITY (Calendar), TASKS (Call Task), bottom: Settings + profile.
- Remove `Home`, `Sales*`, `Treatment`, `TodayQueue`/Reception, standalone Appointments page, `SalesShell`, `ConsultShell`, `DashboardLayout` Consult/Sales split. Wire all `/dashboard`, `/patients/*`, `/availability`, `/tasks/*` through `AppShell`. Settings keeps `SettingsShell` inside `AppShell`.
- Login redirects to `/dashboard`. Logout → `/login`. `/` and old `/home`, `/sales*`, `/consult*`, `/treatment*`, `/queue` redirect to `/dashboard`.

## Phase 2 — Dashboard
- Keep existing clinical dashboard. Strip Sales/Treatment/Queue widgets.

## Phase 3 — Patients
- `/patients`: paginated list (20 default, page sizes 10/20/50/100), status filter chips defaulting to `current`, server-side debounced search, CSV + Excel export of current filter, name → link to `/patients/[id]`, skeleton loader, React Query (5min stale, keepPreviousData), select only listed columns.
- `/patients/add`: full form per spec, duplicate check modal (phone OR name match), on save → `attempt1` + today `call_due_date`.
- `/patients/[id]`: keep 4-tab layout, add Lifestyle & Habits + Medical History cards, add "Send Form Link" button (token + copy + WhatsApp) and existing actions.

## Phase 4 — Availability `/availability`
- Replaces old Appointments + Availability pages.
- Day / Week / Month views over `appointments` + `doctor_schedules` + `doctor_exceptions` using existing `generateSlots`.
- Top: doctor picker (from `doctors`), Today, view switcher, prev/next, Search availability, Book Appointment.
- Booked slots show patient name as link, color by status. Empty available slot click → book modal prefilled.
- Book modal: patient combobox (server search), doctor, date, slot grid grouped by session, reason, notes, duration from schedule. Honors `?patient=` query.

## Phase 5 — Tasks `/tasks/call-task`
- Move existing call-task UI here unchanged. Patient names → links.

## Phase 6 — Global Search (top bar)
- Min 2 chars, 300ms debounce, server-side `or(ilike)` on first/last/phone/email, limit 10, React Query 2min cache. Dropdown with avatar+name+phone+status badge, click → `/patients/[id]`. Loading + empty states.

## Phase 7 — Notifications
- Bell with unread count (9+ cap), polls every 60s + realtime subscription on `notifications`. Dropdown lists newest 20 with icon by type, time-ago, patient link, mark-as-read on click, "Mark all read". Empty state.

## Phase 8 — Patient self-fill `/patient-form/[token]`
- Public route, calls `validate_patient_form_token`, error page if invalid, pre-filled form, `complete_patient_form` on save, success page with clinic info. Requires `patient_form_tokens` row creation flow from patient profile (Send Form Link button generates token, 7-day expiry, stores in table).

## Phase 9 — Invoice PDF + WhatsApp
- Add `jspdf` + `jspdf-autotable`. Generate PDF per spec on InvoiceDetail.
- "Download PDF" → local download. "Send via WhatsApp" → upload to `invoices` storage bucket (new, public) at `[clinic_id]/[invoice_id].pdf`, store `pdf_url` on invoice, regenerate only if `updated_at > pdf_generated_at`. Open `wa.me` with prefilled message.
- DB changes: add `pdf_url TEXT`, `pdf_generated_at TIMESTAMPTZ` to `invoices`. Create public `invoices` storage bucket via tool.

## Phase 10 — CSV Bulk Import `/settings/patient-import`
- Settings sidebar adds PATIENTS group with Patient Import.
- PapaParse + SheetJS for `.csv`/`.xlsx`. Template download. Preview first 5 rows, validate (required, phone digits, date, enums), duplicate check by `clinic_id+phone`, summary table, batch insert size 100 with 50ms gap and `Promise.allSettled`, live progress bar.

## Phase 11 — Patient hyperlink audit
- Shared `PatientLink` component (teal `#1D9E75`, underline on hover). Apply to: call task rows, calendar slots, invoice list & detail header, dashboard recent activity, notifications, search results, appointment cards, every patient-name cell.

## Phase 12 — Settings sidebar reorganization
- Rebuild `SettingsShell` nav to the exact spec (Clinic / Users / Patients / Billing / Reports / Clinical / Integrations + Home + Logout). Integrations items show "Coming Soon" badge and route to placeholder.

## Performance pass
- React Query everywhere, `staleTime` 5min, `keepPreviousData`, paginated queries, `select` only needed cols, 300ms debounce on all search inputs, skeleton loaders.

## Technical / DB summary
- **New deps:** `jspdf`, `jspdf-autotable`, `papaparse`, `@types/papaparse`, `xlsx`, `date-fns` (already present).
- **New migration:** `ALTER TABLE invoices ADD COLUMN pdf_url TEXT, pdf_generated_at TIMESTAMPTZ`.
- **New storage bucket:** `invoices` (public).
- **Files removed:** `src/pages/Home.tsx`, `src/pages/Sales.tsx`, `src/pages/SalesPatientDetail.tsx`, `src/pages/Treatment.tsx`, `src/components/receptionist/TodayQueue.tsx` (and Reception page if any), `src/components/layout/SalesShell.tsx`, `src/components/layout/ConsultShell.tsx`, `src/components/layout/DashboardLayout.tsx`, `src/pages/AppointmentsPage.tsx`.
- **Files created:** `src/components/layout/AppShell.tsx` (rewrite), `src/components/layout/TopBar.tsx` (rewrite), `src/components/layout/GlobalSearch.tsx`, `src/components/layout/NotificationBell.tsx`, `src/components/layout/ProfileMenu.tsx`, `src/components/PatientLink.tsx`, `src/pages/PatientsListPage.tsx`, `src/pages/PatientAddPage.tsx`, `src/pages/CallTaskPage.tsx`, `src/pages/PatientFormPublic.tsx`, `src/pages/PatientImportPage.tsx`, `src/pages/IntegrationComingSoon.tsx`, `src/lib/invoicePdf.ts`.
- **Files edited:** `src/App.tsx` (route table), `src/pages/AvailabilityPage.tsx` (full rebuild), `src/pages/PatientDetailPage.tsx` (new cards + Send Form Link), `src/pages/InvoiceDetailPage.tsx` (PDF + WhatsApp), `src/components/layout/SettingsShell.tsx`, `src/hooks/useAuth.tsx` (post-login redirect), `src/pages/Auth.tsx` if needed.

## Questions before I start
1. **Self-form token generation:** the existing schema has `patient_form_tokens`. Should I generate tokens **client-side** (`crypto.randomUUID()`) and insert directly with `expires_at = now()+7d`, or do you want me to create a Supabase RPC `create_patient_form_token(patient_id)` for it? I recommend the RPC for safety — confirm OK.
2. **CSV import scale:** spec mentions up to ~15k rows. Doing 15k inserts client-side (150 batches × 100) will take ~30–60s and is fragile if the tab closes. Acceptable for v1, or should I build an edge function `bulk-import-patients` that takes the parsed rows and inserts server-side? I recommend keeping client-side for v1 to match the spec exactly — confirm.
3. **Doctor source for Availability + Booking:** spec PART 4 says "fetch from profiles" but appointments/schedules use the `doctors` table. I'll use `doctors` (clinic-scoped) for consistency with the existing schedule feature — confirm.
4. **Removing old Appointments page:** the existing `AppointmentsPage` has a lot of functionality (filters, list, edit). The new `/availability` calendar will fully replace it. OK to delete the route entirely, with no `/appointments` redirect?

Once you confirm (or just say "go"), I'll execute the phases in order with parallel file writes, then run typecheck/build and report.
