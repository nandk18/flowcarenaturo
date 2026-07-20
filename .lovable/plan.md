## Root cause

`public/manifest-therapist.webmanifest` has:
- `"scope": "/therapist"`
- `"start_url": "/therapist-login"`

`/therapist-login` is **not inside** the `/therapist` scope, so Chrome/Android and iOS silently reject the manifest as invalid and fall back to letting the user install only the admin manifest (which is why "Add to Home Screen" on the therapist login page ends up installing `/home`).

Previously this worked because either the scope was broader or the start_url lived under `/therapist`. The split-manifest change tightened scope without updating start_url.

A second smaller issue: the therapist app route the login redirects to is `/treatment/therapist`, which is also outside `/therapist` scope, so once installed the app would navigate out-of-scope and lose standalone chrome.

## Fix

Update `public/manifest-therapist.webmanifest`:

- `"scope": "/"` (keep it broad so both `/therapist-login` and `/treatment/therapist` stay in-scope)
- Keep `"start_url": "/therapist-login"`
- Keep `"id": "/?app=therapist"` — the distinct `id` is what tells the browser this is a separate installable app from the admin one, so both icons can coexist on the home screen.

No code changes needed in `useManifestForRoute` — it already swaps the `<link rel="manifest">` correctly when the user is on `/therapist-login`.

## Verification steps for the user after deploy

1. Fully close and reopen the browser on the phone (or use a private tab) to drop the cached manifest.
2. Visit the published `/therapist-login` URL.
3. Use browser menu → Add to Home Screen. It should now install as "FlowCare Therapist" alongside the existing "FlowCare" admin icon.

Note: any device that already installed the admin app from `/therapist-login` before this fix will need the admin icon removed once, then reinstall from `/therapist-login`, because the OS cached the wrong manifest against that visit.
