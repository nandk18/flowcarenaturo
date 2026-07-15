## Goal

Make FlowCare feel like a native app across every page, and split the PWA install into two: **FlowCare Admin** (main app) and **FlowCare Therapist** (therapist app), each with its own icon, name, and start URL.

## Part 1 — Two separate PWAs

Because iOS/Android only reads one `<link rel="manifest">` at install time, we serve the right manifest per route.

- **Static files under `public/`:**
  - `manifest-admin.webmanifest` — `name: "FlowCare"`, `start_url: "/home"`, `scope: "/"`, admin icon.
  - `manifest-therapist.webmanifest` — `name: "FlowCare Therapist"`, `short_name: "Therapist"`, `start_url: "/therapist-app"`, `scope: "/therapist"`, therapist icon (green/teal variant).
  - New icon set for therapist: `therapist-icon-192.png`, `therapist-icon-512.png`, `therapist-apple-touch.png` (generated from FlowCare logo with a "Therapist" accent color/badge).
  - Keep existing `flowcare-icon-*.png` for admin.

- **Dynamic manifest swap:** small hook `useManifestForRoute()` mounted in `App.tsx` that updates `<link rel="manifest">`, `<link rel="apple-touch-icon">`, and `apple-mobile-web-app-title` based on `location.pathname`:
  - Paths starting with `/therapist-login` or `/therapist-app` → therapist manifest + icon + title "FlowCare Therapist".
  - Everything else → admin manifest + icon + title "FlowCare".
  - Remove hard-coded `<link rel="manifest">` from `index.html` (or keep admin as default for first paint).

- **Service worker scope:** keep single `/sw.js` from `vite-plugin-pwa` (it already covers both). No change to `registerSW.ts`.

Result: Installing from `/therapist-login` on a phone gives the therapist icon named "FlowCare Therapist" that opens directly into `/therapist-app`. Installing from anywhere else gives the admin "FlowCare" icon opening into `/home`.

## Part 2 — Native feel across every page

- **Safe-area insets** (`src/index.css`):
  - Add `@supports(padding: env(safe-area-inset-top))` utilities: `.safe-top`, `.safe-bottom`, `.safe-x`.
  - Apply to `AppShell` header (sticky top-14), `MainShell`, `SettingsShell`, `ConsultShell`, `SalesShell`, `TherapistApp` header, `TherapistLogin`, `TopBar`, `TreatmentBoard` sticky header, and any bottom-fixed action bars.
  - Set `<meta name="viewport" content="..., viewport-fit=cover">` in `index.html`.

- **No browser bounce / overscroll** (global CSS):
  - `html, body { overscroll-behavior: none; overscroll-behavior-y: contain; }`
  - `body { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }`
  - For scroll containers inside pages, add `overscroll-behavior: contain`.

- **Tap targets & no-select chrome:**
  - Global `button, [role="button"], a` minimum height `44px` on touch devices via `@media (pointer: coarse)`.
  - `.no-select` utility applied to sidebars, top bars, sticky headers, bottom nav.
  - Disable long-press callout on iOS: `-webkit-touch-callout: none` for nav elements.

- **Standalone-mode tweaks:**
  - Add `useIsStandalone()` hook (`matchMedia('(display-mode: standalone)')` + `navigator.standalone`).
  - Hide any "Install app" prompts / footer chrome when standalone.
  - Add `standalone:pt-safe` class variants where the iOS status bar sits over content.

- **Offline fallback page:**
  - New `public/offline.html` (branded, FlowCare logo, "You're offline — reconnect to continue").
  - In `vite.config.ts` Workbox config, set `navigateFallback: "/offline.html"` (only used when NetworkFirst times out AND cache miss).
  - Precache `offline.html` and the logo it references.

## Part 3 — Page-by-page sync pass

For every page under `src/pages/**` and every shell under `src/components/layout/**`:

1. Ensure top sticky element uses `.safe-top`.
2. Ensure bottom-fixed action bars use `.safe-bottom`.
3. Ensure all touch buttons meet 44px min on `pointer: coarse`.
4. Ensure horizontal scroll rails (Treatment Board columns, Therapist stats) use `overscroll-behavior-x: contain` and `scroll-snap-type` where appropriate.
5. Verify no `overflow: auto` container clips safe-area — swap to `overflow-y: auto; padding-bottom: env(safe-area-inset-bottom)`.

Priority pages verified in this pass: `TherapistApp`, `TherapistLogin`, `TreatmentBoard`, `AdminDashboard`, `Home`, `Sales`, `AppointmentsPage`, `AvailabilityPage`, `SalesPatientDetail`, `PatientDetailPage`, `InvoiceDetailPage`, `PendingInvoicesPage`, `Settings` + subpages, `Onboarding`, `Auth/Login/ForgotPassword/ResetPassword`.

## Part 4 — Housekeeping

- Update `index.html` viewport meta to include `viewport-fit=cover` and keep only default admin manifest for first paint.
- Document in-app: brief toast the first time a therapist opens `/therapist-login` on mobile Safari/Chrome telling them "Tap Share → Add to Home Screen to install FlowCare Therapist" (only when not already standalone).

## Notes / caveats

- Users who already installed the previous single "FlowCare" PWA on their phone will need to **reinstall** to get the therapist variant — OSes bake `start_url`, `id`, `scope`, `name`, and icons at install time.
- Live preview inside Lovable editor won't reflect standalone mode; test on the published URL from a real phone.
- No backend / DB changes.

## Files touched (summary)

- `public/manifest-admin.webmanifest` (new), `public/manifest-therapist.webmanifest` (new), `public/offline.html` (new), new therapist icons in `public/`.
- `index.html` — viewport, drop static manifest link.
- `src/App.tsx` — mount `useManifestForRoute`.
- `src/hooks/useManifestForRoute.ts` (new), `src/hooks/useIsStandalone.ts` (new).
- `src/index.css` — safe-area utils, overscroll, tap-target, no-select.
- `src/components/layout/*` — apply safe-area to shells and headers.
- `src/pages/**` — targeted class additions where sticky/fixed chrome exists.
- `vite.config.ts` — `navigateFallback: "/offline.html"`, include offline assets.
- Remove `public/manifest.webmanifest` (replaced by the two scoped ones).
