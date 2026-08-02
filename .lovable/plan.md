## Goal

Extend the existing Twilio WhatsApp automation to send:
1. A 2-hour appointment reminder for **all** appointment types.
2. A therapist review link immediately when a therapy session is marked **completed**.

Both messages are business-initiated, so they must use approved Twilio Content Templates and server-side sending only.

## Twilio Content Templates to create

### Template A: Appointment reminder
**Body:** `Hi {{1}}, reminder: appointment at {{2}} on {{3}} at {{4}} with {{5}}. See you soon!`

**Variables:**
1. `patient_name`
2. `clinic_name`
3. `appointment_date` (DD/MM/YYYY)
4. `appointment_time` (hh:mm AM/PM)
5. `doctor_name`

**Suggested Twilio template name:** `flowcare_appointment_reminder`

### Template B: Therapist review request
**Body:** `Hi {{1}}, thank you for choosing {{2}}. How was your {{3}} session with {{4}}? Please rate your experience: {{5}}`

**Variables:**
1. `patient_name`
2. `clinic_name`
3. `service_name`
4. `therapist_name`
5. `review_link` (full URL — declare as URL type in Twilio)

**Suggested Twilio template name:** `flowcare_therapist_review`

## Implementation plan

### 1. Secrets / config
Add three new project secrets after the Twilio templates are approved:
- `TWILIO_TEMPLATE_REMINDER` — ContentSid for the reminder template.
- `TWILIO_TEMPLATE_REVIEW` — ContentSid for the review template.
- (Optional) `REMINDER_HOURS_BEFORE` default `2` if we want the lead time configurable.

### 2. Extend `whatsapp_messages`
Add a nullable `therapy_session_id uuid` column with FK to `therapy_sessions.id` so review sends can be logged and deduped separately from appointment sends. Keep `appointment_id` nullable for review-only sends.

### 3. Appointment reminder scheduler
Create a new Postgres function `send_due_appointment_reminders()` that:
- Looks at `appointments` where `appointment_date + appointment_time` is within the next ~2 hours (configurable window).
- Skips rows with `status = 'cancelled'`.
- Skips rows that already have a `whatsapp_messages` row with `event = 'reminder'` and `status = 'sent'`.
- For each due appointment, calls the existing `send-appointment-whatsapp` Edge Function via `pg_net` with `{ appointment_id, event: "reminder" }`.

Schedule this function to run every 15 minutes. Prefer `pg_cron` if the extension is enabled; otherwise use the existing `background_jobs` queue + a lightweight Edge Function scheduler.

### 4. Therapy review link trigger
Extend the existing `create_review_on_session_complete` trigger (or add a companion AFTER UPDATE trigger on `therapy_sessions`) so that when `status` changes to `completed`:
- Ensure the `therapy_session_reviews` row exists (the current trigger already creates it).
- Call `send-appointment-whatsapp` via `pg_net` with `{ therapy_session_id, event: "review" }`.
- Guard against duplicate sends by checking `whatsapp_messages` for an existing `event = 'review'` + `therapy_session_id` sent row.

### 5. Update `send-appointment-whatsapp` Edge Function
Add handlers for the two new events:

**`reminder`**:
- Load appointment, patient, clinic, doctor — same as `booked` flow.
- Use Template A variables.
- Log to `whatsapp_messages` with `event = 'reminder'`.

**`review`**:
- Load `therapy_sessions` + `therapy_session_reviews` by `therapy_session_id`.
- Load patient, clinic, therapist, service name.
- Build review URL: `${PUBLIC_URL}/review/${token}`.
- Use Template B variables.
- Log to `whatsapp_messages` with `event = 'review'` and `therapy_session_id`.

### 6. UI status indicators
- In the appointment detail dialog on Availability, show a "Reminder sent" badge if a `reminder` row exists in `whatsapp_messages`.
- In the Treatment Board / Therapist App, show a "Review sent" badge on completed sessions when a `review` row exists.

### 7. Testing
- Create the Twilio templates and wait for Meta approval.
- Set the new ContentSids as secrets.
- Book a test appointment ~2 hours out and verify the reminder fires within the 15-minute scheduler window.
- Mark a therapy session completed and verify the review link is sent.
- Confirm both appear in `whatsapp_messages` with correct `status` and no duplicate rows.

## What I need from you before building
1. Create the two Twilio Content Templates with the exact bodies above and paste the approved `ContentSid` values here.
2. Confirm the public URL for review links (`https://flowcarenaturo.lovable.app/review/<token>` is correct).
3. Confirm the rotated `TWILIO_AUTH_TOKEN` is already stored as a project secret (the previous token was compromised).