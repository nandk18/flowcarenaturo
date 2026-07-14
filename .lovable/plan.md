## Overview

Five fixes: three are tightly related to the current therapist-only PWA (flicker, stale cache after publish, wrong install target/icon). Two are UX additions on the Treatment Board and Therapist App.

---

## 1 + 2 + 5. Whole-app PWA with your FlowCare logo, no more flicker/stale cache

Root cause of #1 and #2: the current service worker (`vite-plugin-pwa` + Workbox) precaches the built JS/CSS and serves navigations from cache. When a new version publishes, the old SW keeps serving stale HTML/chunks until the browser revalidates — that shows up as flicker (old → new swap on reload) and "only updates after clearing cache". The current manifest also scopes the installable app to `/therapist-login` only, which is why "Add to Home Screen" always lands there.

**Icon asset**
- Upload `user-uploads://3e4b329d-…JPG` via `lovable-assets` and save it into `public/` as `flowcare-icon-512.png` (also generate/downscale a 192×192 variant `flowcare-icon-192.png` and a `favicon.png`).
- Replace `index.html` favicon + `apple-touch-icon` + `theme-color` + `apple-mobile-web-app-title` to point at the new FlowCare icon and name.
- Keep `public/therapist-icon-512.png` untouched for backward compatibility, but stop referencing it.

**Manifest — cover the whole app**
Rewrite `public/manifest.webmanifest`:
- `name: "FlowCare"`, `short_name: "FlowCare"`
- `start_url: "/"`, `scope: "/"`, `id: "/"`
- `display: "standalone"`, `theme_color`, `background_color`
- Icons: 192 + 512 (`any`) and 512 (`maskable`) all pointing at the new FlowCare asset

**Service worker — stop the stale-cache/flicker loop**
Update `vite.config.ts` VitePWA config:
- Keep `registerType: "autoUpdate"`, keep `injectRegister: null` (wrapper stays the single registrar).
- **HTML is always NetworkFirst with a short timeout**, and precached HTML is disabled so a new deploy is picked up on the next navigation instead of served from precache. Remove `html` from `globPatterns` (keep `js,css,ico,png,svg,webmanifest`) and set `navigateFallback: null` so navigations always hit the network first.
- Add `cleanupOutdatedCaches: true` and `skipWaiting: true` + `clientsClaim: true` so the new SW activates immediately after a publish (no more "refresh twice to see the new version").
- Runtime cache stays: NetworkFirst for navigations (2s timeout), CacheFirst only for hashed built assets.

**Wrapper (`src/lib/registerSW.ts`)** — already guards preview/iframe correctly; no logic change needed. It will now register the whole-app SW in production only.

Expected result: installed FlowCare app opens at `/` with the new logo; published site picks up new versions on the next navigation without a manual cache clear; the double-render flicker on load stops because HTML is no longer served from precache.

---

## 3. Treatment Board status chips are clickable filters (default: Not started)

In `src/pages/TreatmentBoard.tsx`:
- Add `statusFilter` state (`"not_started" | "in_progress" | "completed" | "all"`), default `"not_started"`.
- Convert the three status headers/badges (Not started / In progress / Completed) into buttons with `aria-pressed`, active-state styling using existing status tint tokens.
- Filter the rendered patient/session groups by `statusFilter` (keep "cancelled" hidden as today). Show a small "Showing: Not started" pill with a clear/all toggle.
- Keep the live clock, elapsed timers, and therapist picker untouched.

---

## 4. Therapist analytics — click count to see patients

In `src/pages/TherapistApp.tsx` stats strip:
- Wrap the "Today" and "This week" tiles in buttons.
- On click, open a Dialog listing the distinct patients behind that number: name, session count in the period, last service, last completion time. Data comes from the same completed-session query already used for the counts (extend the select to include `patient_id, patients(full_name)`, then group in-memory).
- Reuse the existing Summary dialog styling; no new RPCs.

---

## Technical details

Files changed:
- `public/manifest.webmanifest` — full-app scope, FlowCare name + icons
- `public/flowcare-icon-192.png`, `public/flowcare-icon-512.png`, `public/favicon.png` — new icon set from the uploaded logo (via `lovable-assets` for the source, copied into `public/` for SW/manifest access)
- `index.html` — favicon, apple-touch-icon, apple-mobile-web-app-title = "FlowCare", theme color, manifest link stays
- `vite.config.ts` — Workbox: drop `html` from precache globs, `navigateFallback: null`, `cleanupOutdatedCaches`, `skipWaiting`, `clientsClaim`
- `src/pages/TreatmentBoard.tsx` — clickable status filter chips with `not_started` default
- `src/pages/TherapistApp.tsx` — clickable stat tiles + patient-detail dialog

No DB migrations, no new RPCs, no auth changes.

## Notes / caveats

- Users who already installed the therapist PWA from `/therapist-login` will still open there until their OS refreshes the manifest (iOS/Android cache `start_url` at install time). They'll need to reinstall to land on `/`. New installs pick up the new manifest immediately.
- The SW change fixes flicker/stale cache for all future deploys, but the *current* stale version on a user's machine only clears after one more navigation once the new SW activates (that's the whole point of `skipWaiting` + dropping HTML from precache).
