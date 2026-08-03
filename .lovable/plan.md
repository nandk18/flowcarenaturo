## 1. Reuse the booked template for reminders

No new Twilio template needed. Change the template map in `send-appointment-whatsapp` so `reminder` falls back to the booked ContentSid when `TWILIO_TEMPLATE_REMINDER` is not set:

```ts
reminder: Deno.env.get("TWILIO_TEMPLATE_REMINDER") ?? Deno.env.get("TWILIO_TEMPLATE_BOOKED") ?? "",
```

Variables are already identical (name, clinic, date, time, doctor), so nothing else changes. You can still set `TWILIO_TEMPLATE_REMINDER` later if you want a distinct wording.

## 2. New "no follow-up in a week" care message

### Twilio Content Template
**Suggested name:** `flowcare_followup_care`

**Body:** `Hi {{1}}, We hope you are doing well. This is a friendly reminder from {{2}} to book your follow-up appointment. If you have not yet scheduled your next appointment, please reply to this message or contact our team to book a convenient time. Thank you, Team {{2}}`

**Variables:**
1. `patient_name`
2. `clinic_name`

Store the approved ContentSid as secret `TWILIO_TEMPLATE_FOLLOWUP`.

### Edge function
Add a `followup` event to `send-appointment-whatsapp`:
- Load the appointment, patient, clinic, doctor (same lookups as `booked`).
- Skip if a `whatsapp_messages` row with `event = 'followup'` and `status = 'sent'` already exists for that patient in the last 30 days (patient-level dedupe, not just appointment-level, so a patient never gets spammed).
- Send with the three variables above and log as `event = 'followup'`.

### Scheduler
New Postgres function `send_due_followup_messages()`:
- Finds appointments whose `appointment_date` is exactly 7 days ago, `status = 'completed'` (skips cancelled/no-show).
- Excludes patients who have any non-cancelled appointment dated after that visit (i.e. they already came back or booked ahead).
- Excludes patients already sent a `followup` message in the last 30 days.
- Calls the edge function via `pg_net` with `{ appointment_id, event: "followup" }`.

Scheduled with `pg_cron` once daily at 10:00 IST (04:30 UTC) so messages land at a reasonable hour.

### UI
`WhatsAppStatus` gets a `followup: "Follow-up care message"` label, so the badge shows on the appointment detail dialog in Availability alongside the booking/reminder rows.

## What I need from you
1. The ContentSid for `flowcare_followup_care` once approved (secret `TWILIO_TEMPLATE_FOLLOWUP`).
2. Confirm 7 days after a **completed** appointment is the right trigger (vs. 7 days after any booked appointment, including no-shows).
