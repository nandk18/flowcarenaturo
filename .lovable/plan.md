# Daily Ops rows + Analytics: match the mockups exactly

## 1. Daily Ops — Call task

**One row design for all four task types.** Today the lead-call rows are rendered by a separate component (`CallTask` inside `Sales.tsx`) and look different from appointment / care / cancelled rows. Extract a single `CallTaskRow` component and use it for all four:

```text
[icon chip]  Name   +91 phone                         [ Call ] / [ WhatsApp ]
             Lead call · overdue 66 days
```

- Left: 26px rounded icon chip, tinted by task type (lead = phone, appointment = calendar, care = heart, cancelled = x) but identical size/shape/spacing.
- Line 1: patient name (bold, links to profile) + phone in muted grey.
- Line 2: `<Task type> · overdue N days` / `· due today` / `· done HH:mm`, coloured red when overdue, amber when due today, grey when done.
- Right: single primary action button (Call or WhatsApp) plus the existing "Log call" dropdown where that type has outcomes. Note textareas move behind the row (shown only after the row is expanded) so every row is the same height, as in the mockup.

**Status becomes a dropdown.** Replace the three chips (overdue / due today / done today) with one dropdown: `All`, `Overdue (n)`, `Due today (n)`, `Done today (n)`, sitting next to the existing `Type: All` dropdown. `All` shows every group stacked with its own coloured group header (`Overdue — 2`, `Due today — 4`, `Done today — 6`); selecting one status shows only that group. The dashed "Rest of today's tasks are clear" empty state stays.

## 2. Analytics — exactly the seven screenshots

The header (title, "Everything the doctor needs to see, in one glance", period segmented control, `View: …` dropdown) stays as-is. Two changes:

- **Replace the tab strip** with the `View:` dropdown only (Overview, Revenue, Patients, Appointments, Leads, Treatments, Therapists) — the horizontal tabs go away.
- **Trim each view to exactly what the screenshot shows**, deleting every extra card, table and secondary KPI strip:

| View | KPI tiles | Below |
| --- | --- | --- |
| Overview | Follow-up conv., Package completion, Revenue collected, Outstanding, Appointments (with sparklines) | Revenue over time (bars) · Collected vs outstanding (donut) · Follow-up funnel (Sent/Booked bars) |
| Revenue | Revenue billed, Collected, Outstanding, Avg. bill value | Revenue over time (bars) · By treatment type (donut) · Revenue by treatment type table |
| Patients | New patients, Active patients, Returning rate, Avg. patient value | New patients over time (bars) · Patient status donut (Current/Closed/Lapsed) |
| Appointments | Total appointments, Completed %, Cancelled, No-shows | Appointments over time (bars) · Outcome breakdown donut |
| Leads | New leads, Conversion rate, Avg. attempts to close, Lapsed | Pipeline funnel (Attempt 1→Closed bars) · Lead source donut |
| Treatments | Sessions completed, Package completion, Most booked, Avg. sessions/package | Sessions by treatment type (bars) |
| Therapists | Therapists, Sessions handled, Busiest, Avg. sessions/therapist | Sessions per therapist (bars) |

Everything else currently on the page (line charts, extra tables, reviews/overdue tiles, secondary KPI rows) is removed. KPI tiles use the mockup style: coloured left rail, small label, big value, optional trend chip.

## Technical notes
- Files: `src/pages/CallTaskPage.tsx`, the `CallTask` export in `src/pages/Sales.tsx`, a new `src/components/dailyops/CallTaskRow.tsx`, and `src/components/analytics/AnalyticsView.tsx` (reusing existing `KpiCard`, `BarChartCard`, `DonutChart`, `FunnelChart`).
- Presentation only — no RPC, migration, route or business-logic changes; all figures keep coming from the existing analytics RPCs. Where a screenshot metric has no RPC field today (e.g. avg. bill value, avg. sessions/package), it is derived in the client from values already returned.
- Colours only via existing semantic tokens.
- The CSV export button stays in the Analytics toolbar.
