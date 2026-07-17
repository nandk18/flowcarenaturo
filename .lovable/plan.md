# Plan: Clinical Dashboard mobile + Analytics therapist count fix

## 1. Clinical Dashboard mobile view (`src/pages/AdminDashboard.tsx`)

Root cause: the appointment rows in `ConsultationTabs` and `TreatmentTabs` use a single horizontal flex row with a fixed time column, patient name/status badge, doctor/service line, and up to 3 action buttons ("Reschedule", "Cancel", "Start Consultation" / "Start Treatment"). At 390 px the long labels ("Start Consultation", "Walk-in / Book Appointment") push everything sideways, squishing the patient name and clipping actions. The top toolbar also has a wide primary button on the same row as the mode switcher.

Changes (presentation only, no logic):

- **Row layout**: Restructure each appointment `Card` to be a two-row layout on mobile and revert to a single row on `sm:` and above.
  - Row A: time badge + patient name + status badge (wrap-safe with `flex-wrap`, `min-w-0`, `truncate`).
  - Row B: service/doctor line, then a right-aligned action cluster.
  - Use `flex-col sm:flex-row sm:items-center` on the outer `CardContent`.
- **Action buttons**: Add `whitespace-nowrap`; hide text labels on mobile via `<span className="hidden sm:inline">Start Consultation</span>` (keep icon visible so mobile shows compact icon-only buttons). Applies to "Start Consultation", "Continue", "Start Treatment", "View Summary", "On Board", "View".
- **Top toolbar** (lines 357–381): change to `flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`; shrink the primary button label on mobile to "Book" (icon + short label) while keeping full label at `sm:`.
- **StatCard grid**: keep `grid-cols-2 md:grid-cols-4` but tighten `StatCard` on mobile (smaller icon container, `text-lg` value on mobile, `p-3 sm:p-4`) so 2 cards fit cleanly at 390 px.
- **Page header**: reduce `text-2xl` → `text-xl sm:text-2xl` and add `px-1` safe padding if needed.

No changes to data fetching, status logic, or handlers.

## 2. Analytics — therapist completed count inflated

Root cause (verified by reading `analytics_therapists` in the DB): the RPC LEFT JOINs `therapy_sessions` **and** `therapy_session_reviews` in the same `FROM` clause and then `COUNT(ts.*) FILTER (WHERE ts.status='completed')`. Because both joins hang off `profiles`, Postgres produces a Cartesian product per therapist: N sessions × M reviews rows. Every session is counted M times (and every review N times), so `completed`, `cancelled`, `unique_patients`, `avg_minutes`, `reviews_count`, and `reviews_sent` all inflate whenever a therapist has any reviews in the range.

Fix: rewrite `public.analytics_therapists` to aggregate sessions and reviews in **separate CTEs** and join the pre-aggregated results to `profiles`. Structure:

```text
sess  = SELECT therapist_id, count/filter aggregates FROM therapy_sessions ... GROUP BY therapist_id
rev   = SELECT therapist_id, avg(rating), count(...) FROM therapy_session_reviews ... GROUP BY therapist_id
per   = SELECT p.*, sess.*, rev.* FROM profiles p LEFT JOIN sess LEFT JOIN rev WHERE p.is_therapist ...
```

Everything else (return shape, security check, ordering by completed desc) stays identical, so `AnalyticsView` and `SuperAdminAnalytics` need no changes.

Delivered via one Supabase migration replacing the function definition.

## Verification

- Build/typecheck run automatically.
- Manually sanity-check: pick one therapist with reviews and confirm the returned `completed` matches `SELECT count(*) FROM therapy_sessions WHERE therapist_id=… AND status='completed' AND session_date BETWEEN …`.
- On mobile 390 px preview, confirm appointment rows no longer horizontally clip and buttons remain tappable.
