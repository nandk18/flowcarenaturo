# Landing page, Lead Pipeline in Daily Ops, Lead-source fix

## 1. FlowCare landing page at `/`

Convert the uploaded FlowCare website into a React landing page served at `/` for signed-out visitors.

- New `src/pages/Landing.tsx` recreating the uploaded page's sections: hero ("Nearly half your patients might be lapsing..."), lapse calculator, treatment-drop-off section, "how it works", today-vs-FlowCare comparison, FAQ ("Before you ask"), closing CTA, footer.
- Faithful to the upload's look: paper background with dot grid, Fraunces headings, Work Sans body, IBM Plex Mono accents, teal/green/amber accents, wave dividers, scroll reveal animations (respecting reduced motion). Implemented with Tailwind + tokens rather than raw inline CSS; landing-only tokens scoped so the app UI is untouched.
- Header: FlowCare logo left; right corner gets **Sign in** and **Sign up** buttons (plus the WhatsApp CTA from the upload), linking to `/login` and `/login?tab=signup`.
- Footer: links to Privacy Policy, Terms, DPA, Security (existing pages) plus contact.
- Routing: `/` shows the landing page when signed out (today it redirects to `/login`); signed-in users still land on their dashboard. `/` is added to the public-route list so it never bounces to login.
- Back buttons: Auth page and the Privacy/Terms/DPA/Security pages get a "Back to home" link returning to `/`. Auth reads `?tab=signup` to open the sign-up tab directly.
- SEO: page title/description, single H1, semantic sections, alt text, JSON-LD Organization/SoftwareApplication.

## 2. Lead Pipeline in Daily Ops

- Add a third tab, **Leads**, to `src/pages/TasksPage.tsx` (`/tasks/list?section=leads`), next to Calls and To Do.
- Extract the existing drag-and-drop pipeline board from `AnalyticsView.tsx` into a reusable `src/components/leads/LeadPipelineBoard.tsx` (columns Attempt 1/2/3, Closed, Lapsed; drag to change stage with optimistic update + Supabase write; click a card to open the patient).
- Analytics keeps using the same component, so behaviour stays identical in both places.
- Daily Ops version loads leads directly from `patients` (no analytics PIN dependency) and shows all leads, not capped by a date range.

## 3. "Leads by source" shows 0 leads / 0 won

Confirmed cause: `analytics_leads` computes `by_source` only from patients whose `created_at` falls inside the selected date range, while the pipeline ignores the range. Your lead-source records were created in June–July, so a recent-range selection returns zero rows for every source even though the pipeline shows leads.

Fix: update the `analytics_leads` RPC so source stats cover the same lead set as the pipeline — count every lead with a `lead_source`, and report range-limited counts alongside the all-time counts. The UI will label the card so the numbers are unambiguous ("in range" vs total), and the CSV export follows the same numbers.

## Technical notes

- New files: `src/pages/Landing.tsx`, landing section components under `src/components/landing/`, `src/components/leads/LeadPipelineBoard.tsx`.
- Edited: `src/App.tsx` (public `/` route), `src/pages/Auth.tsx` (back link + `?tab=signup`), legal pages (back link), `src/pages/TasksPage.tsx`, `src/components/analytics/AnalyticsView.tsx`, `index.html` (title/meta), plus a migration replacing `analytics_leads`.
- Fonts (Fraunces, Work Sans, IBM Plex Mono) loaded for the landing page only.
