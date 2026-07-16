
# Analytics Expansion Plan

Two audiences, one data layer:
- **Clinic Analytics** (Settings → Analytics) — scoped to the logged-in clinic
- **Super Admin Analytics** (Super Admin dashboard) — aggregated across all clinics, with drill-down per clinic

Everything below is derivable from tables you already have (`appointments`, `therapy_sessions`, `invoices`, `payments`, `patients`, `treatment_plans`, `therapy_session_reviews`, `profiles`, `expense_list`, `audit_logs`, `patient_idle_log`, `call_logs`, `push_subscriptions`).

---

## 1. Analytics Categories & Metrics

### A. Revenue & Billing
- Gross revenue, net revenue (post-discount), GST collected
- Revenue by service, by doctor, by therapist, by day/week/month
- Payment mode split (Cash / UPI / Card / Bank / Other)
- Outstanding receivables (aging: 0–7 / 8–30 / 30+ days)
- Average invoice value, invoices/day
- Refunds & discounts applied
- Petty cash movement + expense category breakdown (net profit)

### B. Patients
- New vs returning patients (per period)
- Lead funnel: enquiry → attempt1/2/3 → converted → current → dormant
- Retention cohort (patients returning within 30/60/90 days)
- Demographics: age buckets, gender, blood group, city
- Top referral sources (if captured)
- Patient lifetime value (LTV)
- Churn / dormant patients (no visit in 90+ days)

### C. Appointments & Consultations
- Bookings per day/week, by doctor
- Show / no-show / cancellation / reschedule rates
- Utilization %: booked vs available slots
- Lead time (booking date → appointment date)
- Peak-hour heatmap (day × hour)
- Average consultation duration

### D. Treatments & Therapy Sessions
- Sessions completed/cancelled/pending per day
- Service popularity (top treatments)
- Plan adherence: sessions_completed / total_sessions
- Plan completion rate & average duration
- Idle time per patient (from `patient_idle_log`)
- Capacity utilization per service (vs `max_per_day`)
- Room utilization

### E. Therapist Performance
- Sessions handled per therapist (day/week/month)
- Unique patients handled
- Average session duration (started_at → completed_at)
- Review scorecard: avg rating, count, distribution (0–5)
- Review response rate (sent vs submitted)
- Idle time between sessions

### F. Clinical Operations
- Notes completion rate (visits with clinical notes vs without)
- Prescription volume, top medications
- Lab orders raised, turnaround time, pending results
- Template usage frequency
- Opening/closing checklist completion streaks

### G. Communication & Engagement
- WhatsApp reminders sent (by template type)
- Call log outcomes (connected / no answer / callback)
- Review request send-rate + submission-rate + avg rating
- Push notification delivery to therapists

### H. Security & Audit (super admin mainly)
- Login volume, failed logins
- Audit-log activity by user/action
- Session-timeout events

---

## 2. Clinic Analytics Page (per-clinic)

Location: **Settings → Analytics** (extend existing `AnalyticsPage.tsx`).

Layout:
- Global filters: date range, doctor, therapist, service
- Tabs: **Overview · Revenue · Patients · Appointments · Treatments · Therapists · Clinical · Engagement**
- Each tab: KPI strip (4–6 stat cards) + 2–3 charts + a sortable table + CSV export

Uses `get_clinic_id_safe()` — all queries scoped automatically by existing RLS.

---

## 3. Super Admin Analytics (cross-clinic)

Location: New tab in `SuperAdmin.tsx` → **Analytics**.

Views:
- **Platform Overview**: total clinics, active clinics (activity in last 30d), MRR proxy (sum of paid invoices), total patients, total sessions
- **Clinic Leaderboard**: table of all clinics with revenue, patients, sessions, avg review — sortable, exportable
- **Growth trends**: new clinics/month, new patients/month, sessions/month (stacked by clinic)
- **Feature adoption**: % clinics using treatment plans, WhatsApp, push, reviews, PWA installs
- **Health signals**: clinics with 0 activity in 7/30 days (churn risk), overdue invoices, failed edge-function calls
- **Drill-down**: click any clinic → same clinic-analytics page filtered to that `clinic_id`

Access: gated by `is_super_admin(auth.uid())`.

---

## 4. Technical Approach

**Data layer** — one Postgres RPC per metric group, returning aggregated rows so the browser never pulls raw tables:
- `analytics_revenue_summary(clinic_id, from, to)`
- `analytics_patient_funnel(clinic_id, from, to)`
- `analytics_appointment_stats(clinic_id, from, to)`
- `analytics_therapy_stats(clinic_id, from, to)`
- `analytics_therapist_performance(clinic_id, from, to)`
- `analytics_engagement(clinic_id, from, to)`
- Super-admin variants: same signature with `clinic_id = NULL` returning per-clinic rows, guarded by `is_super_admin`.

**Frontend**:
- `src/lib/analytics/` — one hook per RPC (`useRevenueSummary`, etc.) via React Query, 5-min stale time
- `src/components/analytics/` — reusable `KpiCard`, `TrendChart`, `BarChart`, `HeatMap`, `DataTable`, `CsvExportButton` (using recharts, already in stack)
- `src/pages/AnalyticsPage.tsx` — refactored into tabs
- `src/pages/SuperAdminAnalytics.tsx` — new page, reuses the same components with cross-clinic mode

**Performance**:
- All aggregation server-side, indexed on `(clinic_id, date)`
- CSV export via existing pattern
- Date range default: last 30 days

**Rollout order**:
1. Revenue + Patients + Appointments tabs (highest value)
2. Treatments + Therapists tabs (reuses existing scorecard RPC)
3. Clinical + Engagement tabs
4. Super Admin Analytics page + drill-down

---

## 5. Open Questions Before Build

1. Should super admin see raw patient names, or anonymized IDs only (privacy)?
2. Do you want scheduled email/WhatsApp digests (daily/weekly summary), or in-app only for now?
3. Any metrics above you want to drop or add (e.g. staff attendance, marketing spend ROI)?
