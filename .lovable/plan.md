## What I found

The published `/therapist-login` page is rendering the therapist sign-in screen, and the therapist manifest file itself is correct:

- `manifest-therapist.webmanifest` has name `FlowCare Therapist`
- `start_url` is `/therapist-login`
- icons point to therapist icon files

But the initial HTML still contains the admin manifest first:

```html
<link rel="manifest" href="/manifest-admin.webmanifest" />
```

Then JavaScript changes it to the therapist manifest. This is fragile for Chrome/Safari Add to Home Screen because install detection can read the manifest before or independently of that JavaScript mutation. That explains why the install dialog still uses `FlowCare` and `/home`.

## Plan

1. **Stop using one HTML manifest tag for both apps**
   - Remove the hardcoded admin manifest link from `index.html`.
   - Add a small pre-React script that creates exactly one manifest link before the browser sees a stable manifest choice.
   - If the path is `/therapist-login`, `/therapist-app`, `/therapist`, or `/treatment/therapist`, create:
     ```html
     <link rel="manifest" href="/manifest-therapist.webmanifest">
     ```
   - Otherwise create:
     ```html
     <link rel="manifest" href="/manifest-admin.webmanifest">
     ```

2. **Also set all install metadata before React loads**
   - Therapist routes get:
     - title: `FlowCare Therapist`
     - apple title: `FlowCare Therapist`
     - apple touch icon: `/therapist-apple-touch.png`
     - favicon/icon links: therapist icons
   - Admin routes keep:
     - title: `FlowCare`
     - apple title: `FlowCare`
     - apple touch icon: `/apple-touch-icon.png`
     - favicon/icon links: FlowCare icons

3. **Update the React fallback hook to match**
   - Keep `useManifestForRoute` for client-side navigation.
   - Include `/treatment/therapist` in its therapist route detection.
   - Ensure it updates favicon/icon links too, not just manifest + apple icon.

4. **Add a cache-busting query to manifest hrefs**
   - Use `/manifest-therapist.webmanifest?v=therapist-2` and `/manifest-admin.webmanifest?v=admin-2` in the HTML/hook.
   - This helps Chrome/Safari discard the old cached manifest that points to `/home`.

5. **Verify against the published route after implementation**
   - Check `/therapist-login` final DOM manifest href is therapist.
   - Check fetched therapist manifest still returns `start_url: /therapist-login`.
   - Confirm the page does not redirect to `/login` before install metadata is selected.

## Important device step after publishing

Because Chrome/Safari and the OS cache installed web app metadata, you may still need to delete the old wrong home-screen icon once before adding it again. After this fix, the browser will be given only the therapist manifest on `/therapist-login`, not the admin manifest first.