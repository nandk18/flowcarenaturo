# 6-Part App Update Plan

This is a large, multi-area change. I'll execute it in 6 sequential phases, each verified before moving on. Approving this plan kicks off all phases.

---

## Phase 1 — Consult Patients page (`/consult/patients`)

- Add a status filter bar above the list: **Current (default) | All | Attempt1 | Attempt2 | Attempt3 | Closed**.
- Default filter on load = `lead_status = 'current'`.
- Search bar always queries across **all** patients (name / phone / email), ignoring the filter.
- Zero-result empty state: centered `user-plus` icon, message `No patient found for "<term>"`, primary **Add as New Patient** button that opens the existing Add-a-Lead modal with `first_name` pre-filled and `lead_status = 'current'`. On save → navigate to `/consult/patients/:id`.
- Add a DB trigger on `appointments` insert that sets the patient's `lead_status = 'current'` whenever it isn't already.

## Phase 2 — Queue cleanup

- Remove the **Add Patient** button from the Consult Queue (`TodayQueue` / AdminDashboard).
- Empty state copy: `No patients in queue. Book an appointment to add patients.`

## Phase 3 — Reception check-in modal

- New `CheckInModal` shown when a queue item is moved to reception.
- Fields: **Chief Complaint** (required textarea), **Lifestyle** (select), **Height cm**, **Weight kg**.
- Buttons: **Skip & Move** (no save) and **Save & Move** (writes to `visits.chief_complaint`, `lifestyle`, `height_cm`, `weight_kg`, `captured_at_reception = true`).
- DB migration to add `lifestyle text`, `height_cm numeric`, `weight_kg numeric`, `captured_at_reception boolean default false` columns to `visits`.
- Doctor consultation page shows a read-only **Check-in Information** card at the top when any of these fields are populated.

## Phase 4 — Remove double "Dr." prefix

- Add helper `formatDoctorName(name)` in `src/lib/utils.ts` that returns the name as-is if it already starts with `Dr`, otherwise prepends `Dr. `.
- Replace every `\`Dr. ${...}\`` / `"Dr. " + ...` occurrence across appointment form, queue card, invoice, patient profile appointments tab, consult header, etc. with the helper.

## Phase 5 — Remove Send to Lab

- Delete the **Send to Lab** button and call in `OrderInvestigationModal` (and any other consult investigation surface).
- Keep the order form, lab order creation, and `lab_orders` table unchanged otherwise — only the explicit send action is removed.

## Phase 6 — Settings restructure + unified responsive sidebar

### 6a. Move pages into Settings
- Billing, Analytics, Templates are reached only from Settings now.
- Remove them from the Consult sidebar and any other sidebars.
- Keep their existing routes working (linked from Settings).

### 6b. Settings sidebar with categories
Rewrite `/settings` to a two-pane layout: left sidebar of categorized items, right pane renders the selected section.

```text
CLINIC        — Clinic Profile · Opening Hours · Locations
USERS         — Staff Members · Roles & Permissions
CLINICAL      — Templates · Consultation Types
BILLING       — Invoice Services · Store Items · Billing Settings
REPORTS       — Analytics · Revenue Reports
INTEGRATIONS  — WhatsApp (soon) · SMS (soon)
```

Category headers are uppercase small text with a divider. Active item highlighted same as the other app sidebars. **Back to Home** + **Logout** at the bottom.

### 6c. Shared sidebar component
Extract a single `AppSidebar` used by Consult, Sales, and Settings layouts so width, logo, clinic-name header, active state, and bottom actions stay identical. Items per area:

```text
Consult:  Dashboard · Patients · Appointments · Queue
Sales:    Lead List · Call Task · Add a Lead
Settings: (categories above)
```

### 6d. Responsive behavior (applies to all sidebar-using areas)
- **<768px**: sidebar hidden; hamburger in top bar opens it as a left slide-in overlay with dark backdrop and an X close. Nav click auto-closes.
- **768–1024px**: icon-only collapsed rail with tooltips; clicking the toggle expands to full width.
- **>1024px**: full sidebar always visible.

Verify rendering at 375px, 768px, and 1440px after the refactor.

---

## Technical details

- New file: `src/components/layout/AppSidebar.tsx` (config-driven; consumes a `sections` prop).
- New file: `src/components/queue/CheckInModal.tsx`.
- New file: `src/components/patients/AddLeadDialog.tsx` (thin wrapper around the existing `LeadForm` for the empty-state CTA, if not already extractable).
- Edited: `DashboardLayout.tsx`, `Settings.tsx` (rewritten), `ConsultPatients.tsx`, `TodayQueue.tsx`, `AdminDashboard.tsx`, `DoctorConsultationPage.tsx`, `OrderInvestigationModal.tsx`, `AppointmentsPage.tsx`, `PatientInvoicesTab.tsx`, and any file that builds a `Dr. …` string.
- DB migrations:
  1. `visits` columns + trigger update (Phase 3).
  2. `appointments` after-insert trigger to set `patients.lead_status = 'current'` (Phase 1).
- No new external deps required.

## Out of scope / assumptions
- "Clinic Profile / Opening Hours / Locations / Roles & Permissions / Consultation Types / Billing Settings / Revenue Reports / WhatsApp / SMS" sub-pages that don't exist yet will render as `ComingSoon` placeholders inside Settings — content can be filled in later requests.
- Existing data is preserved; no destructive migrations.
