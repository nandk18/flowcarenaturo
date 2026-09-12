# Finish activation change + custom domain switch

## 1. Super Admin approval = full access (no trial)

Today, approving a new clinic starts a 7-day trial and the app later pushes the clinic to the subscription page when that trial ends. You asked to skip trials for now: once you approve a clinic, it gets full access until you disable it. Razorpay billing stays in the code but is not enforced.

Changes:

- Activation function (`super_admin_activate_clinic`): set the clinic active with status `active` instead of `trial`; clear the trial dates; leave patient limits unrestricted.
- Super Admin screen: the button becomes "Activate" with the confirm text "Activate <clinic> with full access?" and the success toast updated; badges show Pending / Active / Disabled instead of trial countdowns.
- Login routing (`authRedirect.ts`, `useAuth.tsx`): keep blocking clinics that are pending or disabled, and stop redirecting anyone to `/subscription` for trial expiry or billing status. The `/subscription` page stays reachable from Settings for later use.
- Existing clinics currently sitting in `trial` are moved to `active` so nobody gets locked out.
- Patient-count limit: the database trigger keeps running but is a no-op while a clinic is fully active (no limit applied).

Nothing about patients, appointments, treatments, or billing data changes.

## 2. Moving to your custom domain

`goflowcare.com` and `www.goflowcare.com` are already added to the project but not live yet (status: initiated), so DNS still needs to finish. Once they go live, the app itself works unchanged — but a few places still hardcode the old `flowcarenaturo.lovable.app` / `stethoscribe.com` addresses and should be updated so links in emails, WhatsApp messages and search results point to the new domain:

- Sign-in and invite redirect addresses (Supabase auth site URL and allowed redirect URLs).
- The public address used in WhatsApp messages, prescription links and staff invite emails.
- Landing page canonical/share tags in `index.html` and the landing page.
- `sitemap.xml`, `robots.txt` and the internal SEO helper, which still say `stethoscribe.com`.
- Razorpay webhook and any external callback URLs (unchanged — they point at the backend, not the website).

No database, login sessions, or stored data are affected by the domain switch; existing users keep working. Old `lovable.app` links keep redirecting to the primary domain once you set one.

## Order of work

1. Apply the activation change (database + Super Admin screen + login routing).
2. On your go-ahead, switch all hardcoded addresses to `goflowcare.com` and finish the DNS connection.
