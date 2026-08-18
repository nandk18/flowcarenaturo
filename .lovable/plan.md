# Zenoti-style UI refresh (whole app)

Restyle the in-app UI to feel like zenoti.com: violet-led palette with teal accent, big confident headings, airy rounded layout, subtle motion. This is presentation-only — no changes to data, routing, or business logic.

## Visual direction

- **Palette (replaces teal-led theme):** deep violet primary `#5B2A9E`, brighter violet `#7C3AED`, teal/cyan accent `#22C1C3`, near-white canvas `#FAFAFD`, ink text `#14122B`. Dark mode gets a deep plum-navy canvas with the same accents.
- **Gradients:** violet → indigo → teal used for the sidebar, hero/header bands, primary buttons and KPI highlights.
- **Typography:** display headings in a large, tight-tracking geometric sans (Space Grotesk kept as display, sized up and bolder); body in Inter with lighter weight and roomier line height. Clear scale: page title, section title, card title, label.
- **Layout & spacing:** more whitespace, wider gutters, larger card radius (16–20px), soft layered shadows instead of hard borders, section headers with short sub-lines.
- **Motion:** fade-and-rise on page/section mount, hover lift on cards and nav items, smooth tab/pill transitions, animated progress and KPI bars. All respecting reduced-motion.

## What changes

1. **Design tokens** — rewrite the color, gradient, shadow and radius variables in `src/index.css` (light + dark) and extend `tailwind.config.ts` with the new gradient/shadow/animation utilities. Every screen that uses semantic tokens picks this up automatically.
2. **Shell chrome** — `SectionShell`, `MainShell`, `AppShell`, `SettingsShell`, `SalesShell`, `ConsultShell`, `TopBar`: gradient sidebar, rounded active nav pills, lighter header with more breathing room, refined badges.
3. **Core components** — button, card, tabs, badge, input, table and dialog variants updated to the new radius/shadow/gradient language (including a `premium` gradient button variant).
4. **Key screens polished** — Home, Admin Dashboard, Daily Ops, Analytics (incl. Leads tab), Patients list/detail, Treatment Board, Therapist App: consistent page headers, KPI cards, card grids and empty states in the new style.
5. **Hardcoded color cleanup** — replace the remaining literal color classes (about 20 files, e.g. `AdminDashboard`, `CallTaskPage`, `SuperAdmin`, `TherapistApp`, `Home`) with semantic tokens so light/dark both look right.

## Technical notes

- No component APIs, props, queries or routes change; only class names, tokens and wrapper markup.
- All colors expressed as HSL variables in `index.css`, mapped through `tailwind.config.ts` — no raw hex in components.
- Status colors (success / warning / destructive / info) are retuned to sit in the new palette while keeping their meaning.
- Motion via Tailwind keyframes already defined plus a couple of new ones; wrapped in `prefers-reduced-motion` guards.
- Rolled out in one pass: tokens first, then shells, then components, then screen-level polish, verifying the preview after each stage.
