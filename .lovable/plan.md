# Landing page: use uploaded logo and WhatsApp number

Update the redesigned `src/pages/Landing.tsx` to use the attached FlowCare logo asset and route every "Talk to us / chat" CTA to WhatsApp **+91 9042866990**.

## Changes

### 1. Use the uploaded logo
- Convert the uploaded image to a Lovable Asset and create the pointer file:
  ```bash
  lovable-assets create --file /mnt/user-uploads/3e4b329d-bdc5-4839-b001-03ce0774b7d7-2.JPG \
    --filename flowcare-logo-landing.png > src/assets/flowcare-logo-landing.png.asset.json
  ```
- Import the asset pointer in `src/pages/Landing.tsx`.
- Replace the inline `LogoSvg` + "FlowCare" text combo in the **sticky header** and **footer** with the new logo image (`alt="FlowCare"`, `height` ~36–40 px, `object-contain`). Keep the header logo linking to `/`.
- Do **not** change the app `Logo.tsx` component, favicon, or PWA icons unless requested later.

### 2. Set the WhatsApp number for all CTAs
- Define a constant in the landing page: `WHATSAPP_NUMBER = "+91 9042866990"` with a default message such as `"Hi, I'd like to know more about FlowCare for my clinic."`.
- Update every WhatsApp touchpoint on the landing page:
  - Header "Talk to us" button
  - CTA band "Message us on WhatsApp"
  - Footer "Message on WhatsApp →"
  - Floating WhatsApp FAB
- Use the existing `openWhatsApp` helper from `@/lib/whatsapp` for consistent desktop/mobile behavior. If that helper pulls in unwanted dependencies for a marketing page, fall back to `https://wa.me/919042866990?text=...` anchor links.
- Remove any generic `wa.me/?` links.

### 3. Verification
- Run build/typecheck; fix any import/asset errors.
- Screenshot the header, CTA band, and footer to confirm the logo renders cleanly and the WhatsApp links point to +91 9042866990.

## What does not change
- Existing landing copy, app screenshots, calculator, section order, routes, `/login` and `/signup` pages, Helmet SEO, and the rest of the app UI.
