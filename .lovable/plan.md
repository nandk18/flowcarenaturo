# FlowCare UI refresh — match the uploaded mockups

Replace the current violet/gradient theme with the calm light system from the six uploaded HTML mockups (dashboard, patient list, patient profile, calendar, daily ops, analytics), applied consistently across every screen. Presentation only — no data, routing or business-logic changes.

## Visual system (taken verbatim from the mockups)

- Canvas `#FBFBFA`, cards/topbar `#FFFFFF`, borders `#E7E5E0` / strong `#D8D5CE`
- Text: primary `#16211D`, secondary `#6B7268`, muted `#9B9F97`
- Brand teal `#0E9A80` (tint `#E7F5F1`, dark `#076B57`) — primary actions, brand mark gradient teal → `#4CC9A7`
- Status: green `#1B8A5A`/`#E9F5EE`, amber `#B9770E`/`#FBF1E1`, blue `#2F6FED`/`#EAF1FE`, red `#C1391F`/`#FBEBE7`
- Sidebar: light blue `#EEF4FC`, border `#D3E1F5`, active item solid `#1D4ED8` with white text, hover `#DDE9FA`
- Radius 10px (6px for nav items/small chips), Inter everywhere (no Space Grotesk display font), flat 1px borders with very soft shadows — no gradients on cards/buttons, no glow

## What changes

1. **Tokens** — rewrite all light/dark HSL variables in `src/index.css` (background, card, border, primary = teal, sidebar = light blue with blue active, success/warning/info/destructive tints) and update `tailwind.config.ts`: radius 10px, `font-display` mapped to Inter, gradient/shadow tokens reduced to the subtle ones the mockups use.
2. **Shells** — `SectionShell`, `MainShell`, `AppShell`, `SettingsShell`, `SalesShell`, `ConsultShell`, `TopBar`: light sidebar with uppercase group labels, 6px-radius nav rows, solid-blue active row, white topbar with bordered search field and a right-side cluster.
3. **Core UI components** — `button` (rounded-md, solid teal primary, quiet outline/ghost, remove `premium` gradient styling), `card` (10px radius, 1px border, subtle shadow), `badge`, `tabs` (underline/segmented as in mockups), `input`, `select`, `table` (light header row, hairline dividers), `dialog`.
4. **Screen-level pass, mockup by mockup** — Dashboard (`AdminDashboard`/`Home`), Patients list, Patient profile (header card + tab strip + info grid), Calendar (`AvailabilityPage`), Daily Ops (`TasksPage`, `CallTaskPage`, `TodoListPage`), Analytics (`AnalyticsView`, `KpiCard`, Leads tab) restyled to match their mockup's layout: page title + subtitle row, KPI tiles, section cards with header rows, quiet empty states.
5. **Hardcoded color cleanup** — replace literal color classes (`bg-red-100`, `text-emerald-600`, etc.) in files like `StatusBadge`, `KpiCard`, `AdminDashboard`, `TherapistApp`, `SuperAdmin`, `LeadPipelineBoard` with the new semantic tokens so status colors match the mockup tints.
6. **Remaining screens** — Treatment Board/Therapists/Scorecards, Settings pages, Invoices, Lead Pipeline, Therapist app inherit the tokens and get a consistent page-header/card treatment so nothing is left on the old violet look.

## Technical notes

- All colors as HSL variables in `index.css`, surfaced through `tailwind.config.ts`; no raw hex in components.
- Dark mode is kept and retuned to a neutral dark version of the same palette (teal accent, blue-tinted sidebar).
- Motion stays minimal: fade-in on mount, subtle hover background changes; drop the lift/glow effects.
- No component props, queries, routes or RPCs change.
