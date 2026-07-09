## Therapist Reviews & Scorecards

### 1. Database (single migration)
New table `public.therapy_session_reviews`:
- `id`, `clinic_id`, `session_id` (FK therapy_sessions, unique), `therapist_id` (FK profiles), `patient_id`, `token` (uuid, unique), `rating` smallint (0–5, validated via trigger), `submitted_at`, `sent_at`, `created_at`, `updated_at`.
- GRANT: `anon` SELECT/UPDATE (needed for public submit via token), `authenticated` SELECT, `service_role` ALL.
- RLS:
  - anon: SELECT + UPDATE only when `token = current_setting('request.jwt.claims',true)` OR simple `USING (true)` on the token-scoped row (we filter by token in the query — safe since token is opaque uuid, only rating can be set).
  - authenticated: SELECT only where `clinic_id = get_clinic_id_safe()`.
- Trigger auto-creates a review row (with token) when a `therapy_sessions` row transitions to `completed`.
- RPC `submit_therapy_review(p_token uuid, p_rating int)` — SECURITY DEFINER, validates 0–5, sets rating + submitted_at once.
- View `therapist_scorecards` (or RPC `get_therapist_scorecards(p_clinic_id)`) returning per therapist: `reviews_30d`, `avg_30d`, `reviews_lifetime`, `avg_lifetime`. Scoped by `has_role`/clinic.

### 2. Public review page
`src/pages/ReviewSubmit.tsx` at route `/review/:token`:
- Fetches session/therapist/clinic info via a new RPC `get_review_context(p_token uuid)` (SECURITY DEFINER, returns therapist name, service, clinic name, already-submitted flag).
- Renders 0–5 star selector + Submit.
- Calls `submit_therapy_review`. Shows thank-you state.

### 3. WhatsApp send
Extend `src/lib/messageTemplates.ts` with `therapy_review_request` template (seeded in `seed_default_message_templates`). Message includes `{therapist_name}`, `{service_name}`, `{review_link}` → `${origin}/review/{token}`.
- **Auto**: after `complete_therapy_session` succeeds in `TherapistApp.tsx` and `TreatmentBoard.tsx`, fetch the review row's token and call `openWhatsApp(patient.phone, message)`.
- **Manual resend**: on Treatment Board completed rows, add a "Send review" button (WhatsApp icon) that opens the same message. Button label switches to "Resend review" if `sent_at` exists, and shows ⭐N if already rated.

### 4. Scorecard UI
- **Admin**: new page `src/pages/TherapistScorecards.tsx` (linked from Treatment section nav). Table: Therapist · 30-day avg (⭐ + count) · Lifetime avg (⭐ + count). Click row → drawer with recent reviews list.
- **Therapist**: on `TherapistApp.tsx` header, add a small "⭐ 4.8 (30d) · 4.7 lifetime" chip that opens their own recent reviews sheet. Uses same RPC filtered to `therapist.id`.

### 5. Files touched
- New: migration, `src/pages/ReviewSubmit.tsx`, `src/pages/TherapistScorecards.tsx`, small `src/lib/therapistReview.ts` helper (build+send WhatsApp).
- Edited: `src/App.tsx` (routes), `src/pages/TherapistApp.tsx` (auto-send on complete + scorecard chip), `src/pages/TreatmentBoard.tsx` (auto-send + resend button), `src/lib/messageTemplates.ts`, `src/components/layout/*` nav for admin scorecard link.

### 6. Out of scope
- No cron reminders for un-submitted reviews (manual resend covers it).
- No multi-dimension ratings — only overall 0–5 stars.
