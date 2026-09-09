# Match the supplied HTML typography

Update the landing page to use the exact font families and weights loaded by `flowcare_website_3-2.html`:

- **Fraunces** (400, 500, 600) for headings and the specified editorial text.
- **Work Sans** (400, 500, 600) for body copy and controls.
- **IBM Plex Mono** (500, 600) for labels, figures, and supporting metadata.

The current landing-page selectors already reference these families and the page already includes the matching Google Fonts URL. The implementation will ensure the font loading and CSS usage remain identical to the supplied HTML, without changing copy, layout, colors, logo, or app-wide typography.

## Verification

- Confirm the browser loads all three font families without errors.
- Compare the rendered landing-page headings, body text, and labels with the supplied HTML on desktop and phone.
- Confirm the rest of the application retains its existing fonts.
