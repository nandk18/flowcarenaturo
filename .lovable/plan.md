## Remove the offline / "You're offline" concept entirely

Users on slow connections are getting bounced to `offline.html` even when they're online. Since the app needs live Supabase data anyway, offline mode adds no value — remove it and let the browser handle real disconnects natively.

### Changes

1. **`vite.config.ts`** — remove all offline behavior from Workbox:
   - Delete `navigateFallback: "/offline.html"` and `navigateFallbackDenylist`.
   - Remove the `NetworkFirst` `html-nav` runtime cache entry for navigations (so HTML always goes to the network, no timeout, no fallback).
   - Keep the `CacheFirst` rule for hashed static assets (JS/CSS/fonts/images) — these are content-hashed and safe to cache.
   - Remove `offline.html` from `includeAssets`.

2. **`public/offline.html`** — delete the file.

3. **`src/lib/registerSW.ts`** — keep as-is (still registers the SW for asset caching + auto-update). No offline logic lives here.

4. **Documentation / plan file** — update `.lovable/plan.md` note about offline fallback to reflect removal.

### Result

- No more false "You're offline" screen, ever.
- Slow networks simply wait for the real response (browser's normal behavior).
- App still installs as a PWA, still auto-updates, static assets still cached for speed.
- No DB / auth / UI changes. No user-visible behavior change except the removal of the offline screen.

### Caveats

- Change applies on the published URL only (SW is disabled in Lovable preview by design).
- Already-installed users pick up the fix on their next visit once the new service worker activates (immediate thanks to existing `skipWaiting` + `clientsClaim`).
