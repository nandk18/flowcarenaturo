# Landing page: UI-only redesign (content stays as-is)

Pure visual/UI overhaul of `src/pages/Landing.tsx`. **No copy is rewritten and nothing is invented** — all existing text, headlines, claims, the lapse calculator, and section messaging are carried over verbatim. Only layout, styling, structure, and visuals change.

## Locked design decisions (already picked)

- **Palette:** Clinical Teal — ink `#0E2A38`, teal `#1C8C82`, green `#3FA66B`, canvas `#F6F8F7`.
- **Typography:** Space Grotesk (headings) + DM Sans (body).
- **Layout:** Full-width sections.

## What changes (UI only)

1. **Sticky header** — FlowCare logo, nav anchors to page sections, Sign in link + Sign up / CTA button. Mobile collapses to logo + Sign in.
2. **Hero** — existing headline/subcopy/CTA kept as-is, but the large "patients on a treatment plan" graphic area is replaced with the real app screenshot (`src/assets/landing/dashboard.png`) presented in a clean browser-frame mockup with a subtle teal gradient backdrop. The lapse stat graphic stays as a supporting element below if it fits the chosen direction.
3. **Real app screenshots added** — captured, cropped and optimized images now in `src/assets/landing/`:
   - `dashboard.png`, `calendar.png`, `daily-ops.png`, `analytics.png`, `patient-profile.png`
   - Used inside browser-frame mockups across the feature sections — the UI change the page is missing today.
4. **Feature sections** — the existing text content is reorganized into alternating text + screenshot rows (Calendar / Daily Ops / Analytics / Patient profile) instead of text-only blocks. Copy unchanged.
5. **WhatsApp section** — same content, restyled to match (kept, re-skinned, no new claims).
6. **Calculator ("See your number")** — kept fully functional, re-styled into the new design system.
7. **CTA band + footer** — existing CTAs and legal links (Privacy, Terms, DPA) preserved, restyled.

## What does NOT change

- No new copy, headlines, stats, or invented numbers — existing text reused verbatim.
- Routes, auth flows, `/login`, `/signup`, legal pages — untouched.
- Rest of the app (dashboard, shells, other pages) — untouched; fonts/colors scoped to the landing page only.

## Technical notes

- Single-file rebuild of `src/pages/Landing.tsx`; images imported from `src/assets/landing/`.
- Space Grotesk + DM Sans loaded via Google Fonts, scoped to landing (app UI keeps Inter).
- Helmet SEO title/meta retained (text may stay identical).
- Browser-frame = simple CSS mockup (traffic lights + URL bar) wrapping the screenshots.
