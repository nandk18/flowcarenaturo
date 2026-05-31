## Issues

**1. "Patient Portal" link on the landing page routes to `/auth`**

The landing nav uses `<Link to="/patient-portal">`. `App.tsx` does have an early-return block for any path starting with `/patient-portal` that mounts `PatientPortalLayout` → which redirects to `/patient-portal/login` when there's no portal session. That should work, but currently the link is being intercepted by the `!session` catch-all (`<Route path="*" element={<Navigate to="/auth" replace />} />`) in some flows — most likely the user is on a stale published build or the early-return runs while `loading === true` and the layout's effect navigates before the path is recognised.

**2. "Could not load prescription. The link may have expired."**

The prescription row has `pdf_url` set to `b0337861.../2026/aa3109fb...html`, but Supabase Storage returns `404 not_found` when creating a signed URL. The `generate-prescription-pdf` edge function ignores the upload error and still writes `pdf_url` to the DB, so any failed upload leaves a permanent broken link.

## Fix Plan

### A. Patient portal navigation
1. In `src/App.tsx`, hoist the `/patient-portal/*` and `/rx/:prescriptionId` routes into a single top-level `<Routes>` that is reached *before* any `loading` / session / profile guard, so the catch-all `Navigate to="/auth"` can never swallow them.
2. Keep the existing public block (`/privacy`, `/terms`, etc.) unchanged.

### B. Prescription viewer self-heals when storage object is missing
1. In `src/pages/PrescriptionViewer.tsx`, when `createSignedUrl` errors *or* the subsequent `fetch(signedUrl)` returns a non-OK status, call the `generate-prescription-pdf` edge function with `{ prescription_id }` to rebuild the HTML, then retry the signed-URL + fetch once. Only show the error UI if the retry also fails.
2. In `supabase/functions/generate-prescription-pdf/index.ts`, capture the result of `storage.upload(...)` and throw if `error` is set (so we never update `pdf_url` against a missing object going forward).

### C. Safety
- No DB schema changes.
- No new RLS or storage policy changes.
- Patient portal works for fully public/anon visitors; viewer regeneration uses the existing edge function which already runs with service-role.

## Files to touch

- `src/App.tsx` — restructure top-level routing so portal + viewer routes are always reachable.
- `src/pages/PrescriptionViewer.tsx` — add regenerate-on-404 retry.
- `supabase/functions/generate-prescription-pdf/index.ts` — surface upload errors instead of swallowing them.

## Verification

1. Logged out → land on `/` → click "Patient Portal" → arrives at `/patient-portal/login` (not `/auth`).
2. Logged in as clinic admin → click "Patient Portal" in nav → same result.
3. Open `/rx/aa3109fb-...` (the currently-broken prescription) → viewer shows a brief loader → regenerates HTML in storage → renders prescription. Re-opening the link is instant.
4. New prescriptions created from a consultation continue to render without the regeneration round-trip.
