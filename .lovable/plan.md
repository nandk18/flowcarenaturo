# Switch hardcoded addresses to goflowcare.com

DNS is verified: `goflowcare.com` points to Lovable and redirects to the primary `www.goflowcare.com`. SSL is still provisioning (finishes on its own). The app keeps working on both addresses; this change only updates the places that hardcode the old `flowcarenaturo.lovable.app` / `stethoscribe.com` addresses so links and search results point at the new domain.

## Changes

1. **`index.html`**
   - Canonical link, `og:url`, and the Organization JSON-LD (`url`, `logo`) → `https://www.goflowcare.com`.
   - No change to the og:image (hosted image, unaffected).

2. **`public/robots.txt`**
   - Sitemap line → `https://www.goflowcare.com/sitemap.xml`.

3. **`public/sitemap.xml`**
   - Replace all `https://stethoscribe.com/...` URLs with `https://www.goflowcare.com/...`.

4. **`src/components/SeoHead.tsx`**
   - `BASE_URL` → `https://www.goflowcare.com` (drives canonical/og tags on landing + legal pages).

5. **`supabase/config.toml`**
   - `site_url` → `https://www.goflowcare.com`.
   - `additional_redirect_urls` → include `https://www.goflowcare.com/auth/callback` (keep the old `flowcarenaturo.lovable.app` callback too, so old links/sessions don't break during the transition).
   - This covers sign-in links, email verification, password reset, and staff invites.

6. **Anything still referencing the old domains elsewhere in `src/`**
   - Search for remaining `flowcarenaturo.lovable.app` / `stethoscribe.com` strings and update each to `www.goflowcare.com` where it's a public-facing address (skip history/docs like `STETHOSCRIBE_*` guides unless they feed the app).

## What does NOT change

- WhatsApp messages, prescription links, invoice links, review links, short links — these already build URLs from `window.location.origin`, so they automatically use whichever address the user is on (new domain once it's live). No code change needed.
- Database, logins, sessions, patients, appointments, treatments, billing data — untouched.
- Razorpay webhook URL — points at the backend (`...supabase.co/functions/razorpay-webhook`), not the website, so it stays as is.
- Old `flowcarenaturo.lovable.app` links keep working and redirect to the primary domain.

## Verify

- TypeScript/build passes.
- Check landing page renders; canonical/og tags show `www.goflowcare.com`.
- Confirm `goflowcare.com` finishes provisioning to Active (usually minutes after DNS verified; up to a few hours).

## Note for you

After this is live, also update the **Supabase dashboard** Auth settings (Authentication → URL Configuration) to add `https://www.goflowcare.com/auth/callback` as an allowed redirect URL and set the Site URL — the config file covers it for future deploys, but the live dashboard setting is what auth uses today.
