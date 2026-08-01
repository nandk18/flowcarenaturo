## First: rotate that Twilio auth token

You pasted your live Twilio auth token in chat. Treat it as compromised — rotate it in the Twilio Console before we wire anything up. I'll store the new one as a project secret (never in code).

## Do you need the Twilio template?

Yes, for WhatsApp. Twilio/Meta only allow free-form text inside a 24-hour window after the patient messages you. An appointment confirmation is business-initiated, so it must use an **approved Content Template** (`ContentSid` + `ContentVariables`) — we can't write our own message body. Your existing template with 5 variables (name, clinic, date, time, doctor) fits the "created" case. We'll need **three** templates total (created / rescheduled / cancelled), or one generic template reused with different variable text.

Also: `+19786447802` looks like the Twilio **sandbox** number. In sandbox, every recipient must first send `join <code>` to that number, and templates are limited. Production sending needs a WhatsApp Business sender approved in Twilio. The build works either way; sandbox just limits who receives.

## What gets built

**1. Secrets**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (rotated), `TWILIO_WHATSAPP_FROM`
- `TWILIO_TEMPLATE_BOOKED`, `TWILIO_TEMPLATE_RESCHEDULED`, `TWILIO_TEMPLATE_CANCELLED` (ContentSids)

**2. Edge function `send-appointment-whatsapp`**
- Input: `appointment_id`, `event` (`booked` | `rescheduled` | `cancelled`)
- Loads patient phone, clinic name, doctor name, date, time
- Normalizes phone to E.164 (`+91…`), skips silently if missing/invalid
- POSTs form-encoded to `https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json` with `To=whatsapp:+…`, `From`, `ContentSid`, `ContentVariables`
- Logs Twilio's status + body on failure and returns it (no silent 500s)

**3. Message log table `whatsapp_messages`**
- `appointment_id`, `patient_id`, `clinic_id`, `event`, `to_phone`, `template_sid`, `twilio_sid`, `status`, `error`
- Clinic-scoped read access for staff; writes from the edge function only
- Gives you a visible audit trail and prevents duplicate sends

**4. Automatic server-side trigger**
- Postgres trigger on `appointments`: fires on INSERT, on date/time change (rescheduled), and on status → cancelled
- Uses `pg_net` (already enabled in this project for therapist push) to call the edge function asynchronously, so booking never blocks or fails if Twilio is down
- Guards: skip if patient has no phone, skip if a successful message for the same appointment+event already exists in the log

**5. Admin visibility**
- Small "WhatsApp sent / failed" indicator on the appointment detail dialog so staff can see whether the patient was notified

## Technical notes
- Twilio requires `application/x-www-form-urlencoded`; `ContentVariables` is a JSON **string** (`{"1":"Nandha",...}`) inside that form body — the JSON in your curl was unquoted and would have failed.
- Auth is HTTP Basic (`SID:AUTH_TOKEN`), built server-side only — never from the browser.
- Existing `wa.me` click-to-chat buttons stay as-is; this is a separate automated path.

## What I need from you before building
1. The rotated auth token (I'll ask for it via the secret prompt).
2. ContentSids for the reschedule and cancel templates — or say "reuse the booked template" and I'll pass adapted variable text.