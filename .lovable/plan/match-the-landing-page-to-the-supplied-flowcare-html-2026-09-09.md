# Match the landing page to the supplied FlowCare HTML

Rebuild the public website to reproduce `flowcare_website_3-2.html` as closely as possible, while keeping the current FlowCare logo and the existing React functionality.

## Locked visual direction

- Follow the supplied HTML’s layout, spacing, typography, wording, and section order exactly.
- Use its pale dotted paper background, navy text, sky-blue emphasis, teal/green accents, amber statistics, thin borders, and restrained shadows.
- Use Fraunces for editorial headings, Work Sans for body text, and IBM Plex Mono for labels and figures, scoped to the landing page only.
- Use the exact headline: **“Most clinics don't know how many patients stop mid-treatment. You could, in the next 20 seconds.”**
- Keep the current FlowCare mark and wordmark, but remove **“Your remote admin partner”** beneath it everywhere the logo appears.

## Landing page changes

1. Recreate the supplied HTML section-by-section: header, hero, treatment-flow visualization, clinic segments, calculator, proof block, how-it-works content, feature grid, before/after comparison, founder note, FAQ, closing action, floating WhatsApp button, and footer.
2. Preserve the existing working calculator, WhatsApp number **+91 9042866990**, sign-in/sign-up access, legal links, and page navigation.
3. Remove the current dashboard, calendar, Daily Ops, analytics, and other product screenshots.
4. Add the attached patient-profile image as the **only** website screenshot, placed in the how-it-works/product area without changing the supplied HTML’s overall composition.
5. Keep the supplied HTML’s existing wording throughout; do not invent replacement marketing copy.
6. Match the desktop reference closely and adapt the same hierarchy cleanly for phones and tablets.

## Sign-in page and shared logo

- Remove the visible **“Sign in to FlowCare”** heading from the sign-in page while retaining the logo, supporting subtitle, tabs, form fields, alerts, and authentication behavior.
- Change shared logo usage so the FlowCare name remains but the tagline is no longer rendered in the landing header, landing footer, or app surfaces.

## Preview and verification

- First render the completed landing page in the live preview for visual review before treating the redesign as final.
- Compare desktop and phone captures against the supplied HTML and attached mockup for typography, spacing, color, and overflow.
- Confirm the patient-profile image is the only product screenshot, all buttons and anchors work, the calculator still updates, WhatsApp opens the correct number, and sign-in behavior is unchanged.
- Check the final build and browser console for errors.

## Technical details

- Convert the attached patient-profile image into a CDN-backed project asset and reference its generated pointer.
- Remove unused screenshot imports and screenshot-only helpers from the landing page.
- Keep landing-specific visual rules scoped to the landing page so the clinical application’s existing design remains unchanged.
- No routing, authentication, database, or business-logic changes.
