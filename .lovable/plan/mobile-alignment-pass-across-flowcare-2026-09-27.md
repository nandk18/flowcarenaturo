# Mobile alignment pass across FlowCare

## Goal
Make the landing page and every user-facing screen comfortable to use on a phone: no clipped text or actions, controls covering content, accidental page-wide sideways scrolling, or unreachable dialog buttons. Keep existing wording, visual identity, permissions, and business behavior unchanged.

## Work
1. **Inventory and check screens.** Cover the public landing, sign-in/sign-up, legal and patient-facing pages; clinic dashboard, patients/profile, Daily Ops, lead pipeline, calendar/booking, billing/analytics, treatments, settings, therapist app, and Super Admin. Check representative empty, populated, filter, menu, and dialog states at narrow and standard phone widths, plus tablet and desktop regression views.
2. **Fix shared foundations first.** Adjust mobile header, sidebar drawer, safe-area spacing, page container, sticky controls, modal/sheet height and scrolling, and long-text wrapping in the shared layouts. Ensure navigation and primary actions remain reachable when the keyboard opens.
3. **Fix screen-specific density.** Give crowded filters/toolbars room to wrap or stack; adapt the calendar's seven-day views and the lead pipeline's wide columns for readable phone use while preserving their desktop layouts; make patient, invoice, analytics, treatment, settings and Super Admin tables/charts usable without hiding essential actions or values. Allow intentional scrolling *inside* dense content, not across the whole page.
4. **Verify visually and interactively.** Revisit the full route inventory on phones (including the current 393px preview), inspect screenshots and element bounds for clipping/overlap, open key menus and dialogs, and recheck tablet/desktop. Resolve each issue found, then report any screens that cannot be tested end-to-end without a signed-in session.

## Technical notes
- Presentation and interaction-layout changes only; no database, payment, permission, or scheduling-rule changes.
- Start with `SectionShell` and sibling layouts, then targeted page/components such as `AvailabilityPage`, `LeadPipelineBoard`, `CallTaskPage`, patient/billing views, and `Landing.css` where the audit finds a problem.
- Public pages currently fit the 393px viewport in a browser check; authenticated routes redirected to sign-in in the local unauthenticated browser, so their rendered states require a valid session or review in the signed-in preview.
