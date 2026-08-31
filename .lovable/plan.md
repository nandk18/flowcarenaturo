# Landing page: proper marketing website with real app screenshots

The current landing page reads like a thesis paper (long text blocks, no product visuals, no header nav). Rebuild it as a modern SaaS marketing site, using real screenshots of the FlowCare app as the centerpiece.

## Locked design decisions (from your picks)

- **Palette:** Clinical Teal — ink `#0E2A38`, teal `#1C8C82`, green `#3FA66B`, canvas `#F6F8F7` (matches the app).
- **Typography:** Space Grotesk (headings) + DM Sans (body).
- **Layout:** Full-width sections.

## Step 1 — Capture real app screenshots

- Screenshot the actual app screens (Dashboard/Queue, Calendar, Daily Ops, Patient Profile, Analytics) from the preview using Playwright, or from the approved redesign mockup HTML files (which mirror the real UI 1:1) if authenticated capture isn't possible.
- Save as optimized images under `src/assets/landing/` (dashboard hero shot + 3–4 feature shots).
- Screenshots will be shown in clean browser-frame/device mockups, not raw pasted images.

## Step 2 — Design preview first (you approve before build)

- Generate 3 rendered design directions for the landing page using the locked palette/type/layout.
- All three share the same colors/fonts/structure; they vary only in composition, density and emphasis.
- You pick one; only then is it implemented.

## Step 3 — Implement `src/pages/Landing.tsx`

Structure (full-width sections):

1. **Sticky header** — FlowCare logo, nav links (Features, How it works, Pricing/Contact), Sign in button + "Book a demo / Get started" CTA.
2. **Hero** — headline + subcopy, primary CTA (Sign up) and secondary CTA, large app screenshot (Dashboard) in a browser frame, subtle teal gradient backdrop.
3. **Logo/trust strip or key stats** (clinics, appointments, messages sent) — keep existing honest claims, no invented numbers.
4. **Feature sections ×3–4** — alternating text/screenshot: Queue & Appointments, Calendar for multiple doctors, Daily Ops (call tasks & to-dos), Analytics. Each with a real screenshot.
5. **WhatsApp automation section** — reminders, follow-ups, review links.
6. **CTA band** — "Ready to run your clinic on FlowCare?" + sign-up button.
7. **Footer** — logo, links to Privacy Policy, Terms, DPA, Sign in; copyright.

- Keep existing SEO (Helmet title/meta) and update copy to match new sections.
- Keep `/login`, `/signup` links and legal routes unchanged.
- Mobile responsive; header collapses to a compact bar with Sign in.

## Technical notes

- Single-file rebuild of `src/pages/Landing.tsx`; new images imported from `src/assets/landing/`.
- Uses the locked fonts via Google Fonts import in `index.css` (scoped to landing classes so the app UI is untouched).
- No changes to routes, auth, or other pages.
- Colors hardcoded in this page only (landing is a standalone marketing surface, consistent with current approach).
