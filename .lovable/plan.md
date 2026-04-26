## Wire performance improvements permanently — drop feature flags

Goal: always use the async queue, cache, query helpers, and retry paths. Delete all feature-flag plumbing.

### 1. VoiceRecorder — always async
File: `src/components/doctor/VoiceRecorder.tsx`
- Remove `import { features } from "@/lib/featureFlags"`.
- Delete the entire synchronous fallback branch (lines ~130–157, the `transcribe-audio` + `format-soap-notes` invoke path).
- Always run the queue path (upload to `audio-recordings` → `enqueue("transcribe_audio", …)` → `waitForJob`).
- Wrap errors in `handleError(err, "voice-recording")` from `@/lib/errors`.
- In the transcribing UI, drop the `features.asyncAI ? … : …` ternary and always show:  
  *"You can switch tabs while AI processes. Notes will appear automatically."*
- Keep rate limiter, manual-mode fallback, and waveform UI untouched.

### 2. Cache hot reads
File: `src/hooks/useClinic.tsx`
- Import `clientCache, CACHE_KEYS, CACHE_TTL`.
- In both `fetchData` (effect) and `refetch`, check `clientCache.get(CACHE_KEYS.clinicSettings(clinic_id))` and `CACHE_KEYS.clinicDoctors(clinic_id)` first. On miss, fetch from Supabase and `clientCache.set(...)` with `CACHE_TTL.clinicSettings` / `CACHE_TTL.doctors`.
- Note: the doctor row here is per-user (filtered by `user_id`), so cache key will be `clinicDoctors(clinic_id)+":"+user_id` — extend CACHE_KEYS with a small variant or just append the suffix inline.

File: `src/components/doctor/TemplateSelector.tsx`
- Same pattern for `note_templates` using `CACHE_KEYS.clinicTemplates` / `CACHE_TTL.templates`.

File: `src/pages/Settings.tsx` — invalidate on writes:
- After clinic update (line ~174) and logo upload (line ~308): `clientCache.delete(CACHE_KEYS.clinicSettings(clinic_id))`.
- After every doctor insert/update/signature change (lines ~192, 197, 282, 326, 341): `clientCache.delete(CACHE_KEYS.clinicDoctors(clinic_id))` (and the per-user variant if used).

### 3. Use query helpers where they fit cleanly
Only swap in places the helper signature already matches what the page wants — don't refactor unrelated logic.
- `src/components/receptionist/TodayQueue.tsx` and `src/pages/DoctorDashboard.tsx`: replace today's-queue fetch with `fetchQueue(clinicId, today, statusFilter)`.
- `src/pages/PatientsPage.tsx`: replace patient list/search with `searchPatients(clinicId, term, page)`.
- `src/pages/PatientDetailPage.tsx`: replace visit-history fetch with `fetchPatientSummary(patientId)`.
- `src/components/layout/DashboardLayout.tsx` (sidebar badges) or wherever the three pending counts are computed: replace with one `countPending(clinicId)` call.

I'll inspect each call site first; if a page uses extra columns the helper doesn't return, I'll either extend the helper or skip that swap and note it in the summary.

### 4. Retry on AI edge function calls
Wrap with `withRetry(() => supabase.functions.invoke(...), 3, 1000)` from `@/lib/errors`:
- `src/components/doctor/ConsultationWorkspace.tsx` line ~232 (`reformat-notes`) and line ~357 (`generate-prescription-pdf`).
- `src/components/doctor/EditVisitSheet.tsx` line ~103 (`generate-prescription-pdf`, keep the `.catch` swallowing).
- `src/components/doctor/LabResultActionPanel.tsx` line ~172 (`generate-prescription-pdf`).
- `src/pages/LabDashboard.tsx` line ~257 (`summarize-lab-result`, fire-and-forget — wrap inside the existing background promise).

Note: `transcribe-audio` / `format-soap-notes` direct calls disappear with step 1 (queue worker handles its own retries via `attempts` column).

### 5. Delete feature-flag plumbing
- Delete `src/lib/featureFlags.ts`.
- Remove the 5 `VITE_FEATURE_*` and `VITE_DEBUG` lines from `.env` (keep `VITE_SUPABASE_*`).
- Confirmed only consumer is `VoiceRecorder.tsx` (the LandingPage match was an unrelated `plan.features.map`). Step 1 already removes that import.

### 6. Verify
- `npx tsc --noEmit` to catch type drift from cache/helper swaps.
- Manual flow per the user's checklist (voice → tab switch → notes appear; second page loads instant; settings save invalidates; patient search paginates; AI calls retry).

### Out of scope
- No DB or edge function changes (queue worker, cache lib, helpers, errors lib, rate limiter all already exist).
- Not touching `src/integrations/supabase/types.ts`.
- Not adding a Redis adapter — `clientCache` stays in-memory; swap point is preserved for later.