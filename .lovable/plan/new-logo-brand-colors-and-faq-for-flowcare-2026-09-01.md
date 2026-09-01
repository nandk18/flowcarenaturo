# New logo, brand colors and FAQ for FlowCare

Swap in the attached wave-mark logo everywhere, adopt the color palette from the uploaded HTML, and add its FAQ section to the landing page. You see a rendered preview of the new landing page before anything is changed for real.

## 1. Logo

- Upload `4.png` (wave mark, transparent-friendly) as a CDN asset and make it the single source for:
  - `src/components/Logo.tsx` (app header / TopBar)
  - `src/components/SidebarLogo.tsx` (sidebar square mark)
  - Landing page header and footer
- Next to the mark, render the name **FLOWCARE** as text styled to match the second image: uppercase, geometric sans, heavy weight, wide letter-spacing, navy `#002E71`, with the small tagline "YOUR REMOTE ADMIN PARTNER" under it on the landing header/footer only.
- Favicon / PWA icons stay as they are unless you ask.

## 2. Colors (from the uploaded HTML)

Replace the landing page's current teal palette with:

```text
paper   #F6F9FA      navy  #002E71      ink       #16233A
paper-2 #EDF3F4      sky   #0F9FE0      ink-soft  #5A6B7B
line    #DCE6E9      teal  #2FAE9C      blue-deep #3773C2
green   #3FAE6E      amber #DB9A3C      whatsapp  #25D366
```

Navy becomes the primary brand color (headings, buttons, links); sky/teal/green are accents matching the logo gradient. Applied to the landing page only — the in-app design tokens are left untouched so the dashboard UI doesn't shift.

## 3. FAQ section

Add a "Common questions / Before you ask" section to the landing page, placed before the closing CTA, with the seven Q&As from the uploaded HTML verbatim (integrations, switching systems, patient records, staff training, treatment plans, connected tools, data security). Styled as a clean divided list, with a nav anchor "FAQ" added to the sticky header.

## 4. Preview first

Before editing `src/pages/Landing.tsx`, a full-page screenshot of the redesigned landing page (new logo, new colors, FAQ) is rendered and shown to you. Only after you approve does the change get applied to the app.

## Technical notes

- New asset pointer `src/assets/flowcare-mark.png.asset.json`; the old `flowcare-logo-landing.jpg` and `flowcare-logo.png.asset.json` references are replaced.
- Landing colors live as constants at the top of `src/pages/Landing.tsx` (existing pattern).
- No copy other than the new FAQ is changed; calculator, screenshots, WhatsApp CTAs (+91 9042866990), routes and legal pages stay as-is.
