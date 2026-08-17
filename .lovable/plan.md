# Settings PIN scope, tab consolidation, and a new "Lapsed" status

## 1. PIN only for Analytics
Today the PIN gate wraps every Settings page. Change it so the PIN is asked only when opening the Analytics area; all other Settings pages open normally (role restrictions unchanged).

- Remove the gate from the shared Settings shell.
- Wrap only the Analytics page content in the gate.
- Keep the "Settings PIN" change card in Clinic Profile, and the super-admin reset, as they are.

## 2. Analytics and Invoice Analytics in one tab
One "Analytics" entry in the Settings sidebar. Inside it, a top-level tab row:

- Clinic Analytics (existing overview/revenue/patients/appointments/treatments/therapists view)
- Invoice Analytics (the current Invoice Analytics page content)

The invoice configuration form (GST, prefix, notes, logo) stays with the Invoice Analytics content. The old `/settings/billing-config` URL redirects into the combined page so existing links and the invoice detail route keep working.

## 3. Call Task and To Do List in one tab
One "Tasks" entry replaces the two sidebar items, showing a page with two tabs: Call Task (default, keeps its badge count) and To Do List. Old URLs redirect to the combined page with the right tab selected.

## 4. Hide checklists, expense list, petty cash
Hidden from navigation (routes left in place so nothing breaks, but not reachable from the menu):

- Main sidebar Tasks group: Opening Checklist, Closing Checklist, Expense List
- Settings sidebar: Opening Checklist, Closing Checklist, Expense Categories, Petty Cash

The Clinical group in Settings keeps Templates and Message Templates.

## 5. New "Lapsed" status for failed follow-ups
Patients who finish the 10 / 15 / 18-day WhatsApp follow-up sequence without booking are set to `lapsed` instead of `closed`.

- Add `lapsed` to the Sales status list, filters, badge colours, status dropdown, and CSV export.
- `closed` stays available for manual "3 no-answer attempts" closures — only the follow-up sweep changes.
- Existing patients already marked `closed` by the follow-up job are left as-is unless you want them converted (say the word and I'll migrate them).

## Technical notes
- `SettingsShell.tsx`: drop `SettingsPinGate`; `AnalyticsPage`/new combined analytics page wraps its body in the gate.
- New `src/pages/SettingsAnalyticsPage.tsx` with `Tabs`, rendering `AnalyticsView` and the extracted Invoice Analytics body; `BillingConfigPage` becomes a component without its own shell.
- New `src/pages/TasksPage.tsx` with tabs rendering the existing Call Task and To Do bodies (each extracted from its `DashboardLayout` wrapper).
- Nav edits in `MainShell.tsx` and `SettingsShell.tsx`; redirects added in `App.tsx`.
- DB: update `send_due_followup_messages()` to set `lead_status = 'lapsed'` (and skip patients already `lapsed`). `lead_status` is free text, so no enum change is needed.
