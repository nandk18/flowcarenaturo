# Follow-up escalation, new analytics, and a Settings PIN

## 1. Follow-up WhatsApp escalation (10 / 5 / 3 days)

Today one follow-up message goes out 7 days after a completed appointment. Replace that with a three-step escalation counted from the patient's last completed visit:

- Day 10 — first follow-up message
- Day 15 (5 days later) — second message
- Day 18 (3 days later) — final message
- After the final message, if the patient still has no confirmed future appointment, set the patient's status to **Closed** (the same "closed" lead status already used in Sales).

At every step the patient is skipped (and the sequence stops) if they have any non-cancelled appointment dated after the last visit — i.e. they came back or booked ahead.

Technical:
- Add a `followup_stage` (1/2/3) concept: the scheduled Postgres function `send_due_followup_messages()` is rewritten to look at each patient's last completed appointment, count how many `whatsapp_messages` rows with `event = 'followup'` and `status = 'sent'` exist for that patient since that visit, and fire the next stage only when the corresponding day threshold is reached.
- The dedupe in the edge function changes from "no follow-up in 30 days" to "no follow-up since the last completed visit within the last 24h", so stages can progress.
- Stage number is stored in the log row so the UI can show "Follow-up 1 of 3".
- Same Twilio template (`TWILIO_TEMPLATE_FOLLOWUP`, two variables: patient, clinic) is reused for all three stages.
- Closing sets `patients.lead_status = 'closed'` and writes an audit log entry.
- Cron stays daily at 10:00 IST.

## 2. Two new analytics (clinic + super admin)

### A. Follow-up conversion rate
Shows how effective the WhatsApp follow-ups are: for each stage (1, 2, 3) — messages sent, how many of those patients booked an appointment within 7 days of that message, and the conversion %. Plus an overall conversion rate and a "closed without booking" count.

New RPC `analytics_followups(p_clinic_id, p_from, p_to)` joining `whatsapp_messages` (event = 'followup') to appointments created after the message.

### B. Treatment package completion %
For treatment plans active in the range: average completion (sessions completed ÷ total sessions across plan items), a distribution of plans by completion bucket (0-25 / 25-50 / 50-75 / 75-99 / 100%), and count of fully-completed plans.

Added to the existing `analytics_treatments` RPC output so no extra round-trip.

Both appear as cards/charts in `AnalyticsView`, which is already shared by the clinic Analytics page and the Super Admin analytics view, so they show in both automatically, and are included in CSV export.

## 3. PIN lock on Settings

One shared clinic PIN. Only users with role **doctor** or **admin** can reach Settings at all; on top of that they must enter the clinic PIN.

Flow:
- First time: if the clinic has no PIN set, the first doctor/admin who opens Settings is asked to create one (4-6 digits, entered twice). It is hashed with pgcrypto — never stored in plain text.
- After that: opening Settings shows a PIN keypad dialog. On success, access is unlocked for the rest of the browser session (cleared on sign-out or after 60 minutes of inactivity).
- Changing the PIN: a "Settings PIN" card inside Settings → Clinic, where a doctor/admin enters the current PIN plus the new one.
- Super admin reset: a "Reset settings PIN" action per clinic in the Super Admin dashboard, which clears the stored PIN so the clinic's next doctor/admin login re-runs the first-time setup. Every reset is written to the audit log.

Technical:
- `clinics.settings_pin_hash` column, plus security-definer RPCs `set_clinic_settings_pin(current_pin, new_pin)`, `verify_clinic_settings_pin(pin)`, `clinic_settings_pin_status()` and `super_admin_reset_settings_pin(clinic_id)` — the hash is never selectable by clients.
- A `SettingsPinGate` wrapper applied in `SettingsShell` / the settings routes so every `/settings/*` page is covered, not just the main one.
- Rate limit: 5 wrong attempts locks the gate for 5 minutes.

## What I need from you
Nothing extra — the existing Twilio follow-up template is reused for all three stages.
