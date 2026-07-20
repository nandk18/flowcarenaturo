## Root cause

`index.html` hardcodes `<link rel="manifest" href="/manifest-admin.webmanifest">`. The React hook `useManifestForRoute` only swaps this link after the app mounts. On Android Chrome, when a user opens the browser menu on `/therapist-login`, Chrome often reads the manifest that was in the DOM at initial page load (the admin one) — especially when the app was just opened from a cold tab, or when the swap hasn't run yet. Result: "Add to Home Screen" installs the admin app pointing at `/home` even though the URL bar shows `/therapist-login`.

The manifest `id` is also derived at initial load, so both installs end up sharing the admin `id` and Chrome treats it as the already-installed admin app.

## Fix

Swap the manifest link and apple-touch metadata in `index.html` **before React loads**, using a tiny inline script that reads `location.pathname`. Keep the React hook as a fallback for client-side navigation.

Changes in `index.html` only:

1. Keep `<link rel="manifest" href="/manifest-admin.webmanifest">` as default.
2. Add an inline `<script>` in `<head>` (runs synchronously before `main.tsx`) that, when `location.pathname` starts with `/therapist-login`, `/therapist-app`, `/therapist`, or `/treatment/therapist`:
   - Rewrites the `manifest` link `href` to `/manifest-therapist.webmanifest`
   - Rewrites `apple-touch-icon` href to the therapist icon
   - Updates `apple-mobile-web-app-title` and `<title>` to "FlowCare Therapist"

No manifest file changes, no React changes.

## Verification

After deploy, on Android:
1. Long-press the admin FlowCare icon → uninstall (only needed once, because the OS cached the wrong install from previous attempts).
2. Open published `/therapist-login` in Chrome → menu → Add to Home Screen.
3. Confirm the install dialog now says "FlowCare Therapist" and the installed icon opens directly to `/therapist-login`.
4. Repeat from `/home` to confirm the admin install still works independently.
