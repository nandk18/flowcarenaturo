## Goal

Stand up the connected Supabase project **Flowcare** (`amipgrjksrszocfzucxn`) as a complete, working backend for this clinic app — matching the schema of the old project `boskgmampbfccbfpgzea`, deploying all 11 edge functions, and creating all storage buckets with the correct policies. Schema only (no data copy).

## Step 1 — Get read access to the old database

Ask you to add a secret called `OLD_SUPABASE_DB_URL` containing the old project's pooled Postgres connection string (Supabase dashboard → Project Settings → Database → URI, with the password). I'll then run `pg_dump --schema-only --schema=public --schema=storage` against it from the sandbox to capture:

- All `CREATE TYPE` enums (`app_role`, plus any clinic/visit/lab status enums)
- All 21 `public.*` tables with columns, defaults, FKs, indexes
- All RLS policies and `GRANT`s
- Triggers and security-definer functions (`has_role`, `update_updated_at_column`, portal helpers, etc.)
- Storage bucket rows + storage RLS policies

The dump is the source of truth — no guessing from frontend code.

## Step 2 — Replay schema into Flowcare

Split the dump into one consolidated migration (or a few logical ones) and submit via the migration tool for your approval:

1. Enums (`app_role` incl. `super_admin`, others)
2. Security-definer helpers (`has_role`, `update_updated_at_column`)
3. Core tables in FK order: `clinics`, `labs`, `clinic_labs`, `profiles`, `user_roles`, `doctors`, `note_templates`, `signatures`, `patients`, `appointments`, `visits`, `clinical_notes`, `prescriptions`, `lab_orders`, `lab_results`, `patient_documents`, `document_shares`, `invoices`, `payments`, `audit_logs`, `background_jobs`
4. Per-table `GRANT`s (authenticated + service_role, anon only where policies allow), `ENABLE RLS`, and policies — including the hardened portal model from the `20260603060958` migration (no `portal_*` anon policies; portal goes through the edge function with HMAC token)
5. Triggers (`updated_at`, audit triggers, any business triggers)
6. Seed `note_templates` rows where `is_system = true` if present in the dump

## Step 3 — Storage buckets

Create the 6 buckets the code uses, with the policies from the dump:

| Bucket | Public | Used by |
|---|---|---|
| `clinic-assets` | public read | Settings, prescription PDF |
| `signatures` | private (clinic/doctor scoped) | Settings, prescription PDF |
| `patient-documents` | private | DocumentsTab |
| `prescriptions` | private (signed URLs) | PrescriptionShareModal, viewer |
| `lab-results` | private | LabResultsInbox, LabResultActionPanel |
| `audio-recordings` | private | VoiceRecorder, process-queue |

## Step 4 — Edge function secrets

Before any function call works I'll request via the secrets form:

- `PORTAL_HMAC_SECRET` (random 32+ byte string — required by `patient-portal`)
- `OPENAI_API_KEY` (Whisper transcription in `transcribe-audio`, `process-queue`)
- `ANTHROPIC_API_KEY` (Claude notes formatting in `format-soap-notes`, `reformat-notes`, `process-queue`, `summarize-lab-result`)
- `RESEND_API_KEY` (if `invite-staff` / `send-lab-order` end up sending email; otherwise skipped)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `LOVABLE_API_KEY` are already present.

## Step 5 — Deploy & verify all 11 edge functions

Deploy: `patient-portal`, `generate-prescription-pdf`, `transcribe-audio`, `format-soap-notes`, `reformat-notes`, `summarize-lab-result`, `invite-staff`, `remove-staff`, `send-lab-order`, `get-public-invoice`, `process-queue`.

Then verify end-to-end:

1. Run `supabase--linter` — must return 0 errors on new tables (RLS enabled, GRANTs present).
2. Quick `read_query` smoke tests: `select count(*) from <each table>` returns 0 with no permission error.
3. Sign up a test admin via `/auth`, confirm `profiles` row + `user_roles` row created (trigger check).
4. Hit `patient-portal` with a bogus payload — should return 400/401, proving HMAC secret is wired.
5. Hit `get-public-invoice` with a fake id — should return 404, proving function reachable.
6. Confirm storage buckets exist and signed URL generation works from Settings page.

## Technical notes

- `src/integrations/supabase/client.ts` and `.env` are already pointed at Flowcare — no client changes needed.
- `src/integrations/supabase/types.ts` regenerates automatically after the migration runs.
- `supabase/config.toml` will be updated if any function needs `verify_jwt = false` (e.g. `patient-portal`, `get-public-invoice`, `generate-prescription-pdf` for public viewer).
- If `pg_dump` from the sandbox is blocked by the old project's network rules, fallback is `supabase--read_query` style introspection against the old DB via a temporary client — slower but works.

## Out of scope

- Copying row data (you chose schema only).
- Rebranding "StethoScribe" → "Flowcare" in the UI (separate task).
- Auth provider configuration (email confirmation, OAuth) — you'll toggle those in the Supabase dashboard.
