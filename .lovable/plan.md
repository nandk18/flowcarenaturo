# Fix follow-up WhatsApp escalation timing (10 / 15 / 18 days)

## What's actually wrong

The analytics numbers are correct — they report exactly what was sent. The sending logic is wrong.

Confirmed from the message log: every patient received all three follow-ups on **three consecutive days** (11, 12, 13 Aug), not 10 / 15 / 18 days apart.

Why: the daily job computes a "target stage" from days since the last visit (>=18 → 3), then sends `sent_count + 1` each run as long as the target is higher than what's been sent. So a patient already past day 18 with nothing sent gets stage 1 today, stage 2 tomorrow, stage 3 the day after. The only spacing guard is "no follow-up in the last 20 hours".

## The fix

Rewrite `send_due_followup_messages()` so each stage has its own due condition, evaluated against both the last visit date and the previous follow-up:

- Stage 1: no follow-up sent yet, and days since last completed visit >= 10
- Stage 2: exactly 1 sent, and >= 5 days since that message
- Stage 3: exactly 2 sent, and >= 3 days since that message
- Close: 3 sent, >= 3 days since the last one, still no future non-cancelled appointment → set `lead_status = 'closed'`

Send at most one message per patient per run (unchanged), and keep the existing skip when the patient has any non-cancelled appointment after the last visit.

Backlog behaviour: a patient who is already 30 days past their visit starts at stage 1 and then progresses on the 5 / 3 day cadence — no burst of three messages.

## Analytics

No change to the `analytics_followups` RPC or the Analytics UI — it already reports per stage, not cumulative. Once the sender is fixed, the stage columns will spread out across dates as expected.

Optionally I can leave the existing (mis-timed) 8–13 Aug rows in place as history; they'll skew the current conversion table until they age out of the selected date range. Say the word if you'd rather clear those log rows.

## Technical

- One migration replacing `public.send_due_followup_messages()` (security definer, same daily 10:00 IST cron).
- Stage passed to the edge function stays `sent_count + 1`; the edge function's 20-hour dedupe stays as a safety net.
- No frontend changes.
