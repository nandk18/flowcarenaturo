# Per-clinic WhatsApp sender number

Today every clinic's WhatsApp messages go out from one shared number and one shared set of approved message templates. This adds a per-clinic choice.

## Three sending modes per clinic

1. **Default (shared)** — current behaviour. Messages come from our number, using our templates. This stays the default for every existing and new clinic, so nothing changes unless someone opts out.
2. **Own number on our account** — the clinic's WhatsApp number is onboarded as a sender inside our Twilio account. We store only the number (and their template IDs). Billing stays with us.
3. **Own Twilio account** — the clinic supplies their own account SID, auth token, sender number, and their own approved template IDs. Messages and billing are entirely theirs.

## Where it is configured

A real **Settings → Integrations → WhatsApp** page (currently a "Soon" placeholder), behind the existing Settings PIN. The clinic admin sees:

- Mode selector: Use FlowCare's number / Use our own number / Use our own Twilio account
- Sender number field (modes 2 and 3)
- Account SID + auth token fields (mode 3 only) — the token is write-only: once saved it shows as "configured", never displayed back
- Six template ID fields: booking, reschedule, cancellation, reminder, review, follow-up
- A **Send test message** button that posts to the clinic's own configuration and reports the exact provider error if it fails
- Current status line: which number is active, and which templates are missing

Super admin gets the same controls on the clinic row in the Super Admin page, plus a "Reset to FlowCare default" action, so you can fix or override a clinic that misconfigured itself. The existing per-clinic WhatsApp on/off kill switch stays and still wins over everything.

## Fallback rule

For each message, the sender resolves in this order: clinic's own configuration if complete and valid → otherwise our shared default. If a clinic is in own-account mode but a template ID for that specific message type is blank, that one message type falls back to the default number/template rather than silently failing. Every send already logs to the message history; the log will also record which sender was used, and failures show the clinic's own Twilio error text on the appointment/session view.

## What the clinic must do themselves

Because they create their own templates, each clinic needs their six templates approved in their own Twilio/Meta account before switching. Until every ID is filled in, the page shows what is still missing and keeps using the default. I will include the exact template bodies and variable order they must submit for approval, shown right on the settings page.

## Technical notes

- New table `clinic_whatsapp_settings` (clinic_id PK, mode, from_number, account_sid, auth_token_secret_ref, six template sid columns, verified_at). RLS: clinic admins read/write their own row; service_role full; super admin via existing role check. Grants for `authenticated` and `service_role`.
- Auth tokens are not stored in the table. Each clinic's token goes into the project secret store under a per-clinic name (e.g. `TWILIO_AUTH_TOKEN_<clinic_uuid_hex>`), written by a new `save-clinic-whatsapp-credentials` edge function using the Supabase Management API; the table holds only the reference name. This keeps credentials out of the database, per the no-secrets-in-tables rule.
- `send-appointment-whatsapp` gains a `resolveSender(clinicId)` step that loads the row, picks account SID/token/from/template SID, and falls back to the current env values. All existing event branches are untouched; only the final Twilio call and the log insert change.
- `whatsapp_messages` gains `sender_mode` and `from_number` columns for traceability.
- New edge function `test-clinic-whatsapp` for the test-send button.
- Note: at ~100 secrets per environment, the per-clinic token approach supports roughly 90 clinics on their own Twilio accounts. If you expect more than that, we should instead encrypt tokens with a single master key in the vault — say the word and I will plan that variant.
