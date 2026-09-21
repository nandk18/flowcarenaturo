# Hide Subscription and simplify WhatsApp settings

## Changes

1. **Hide Subscription for active clinics**
   - Remove **Subscription** from the Settings billing menu.
   - Remove the normal active-clinic `/subscription` page route so it is no longer directly exposed.
   - Keep the existing pending-clinic activation screen and redirect unchanged, because new clinics still need Super Admin approval before accessing FlowCare.

2. **Keep only two WhatsApp choices**
   - Keep **Use FlowCare's WhatsApp number** and **Use our own number (managed by FlowCare)**.
   - Remove **Use our own WhatsApp business account** and its Twilio Account SID/auth-token fields.
   - Remove clinic-owned account credentials from save requests and reject that retired mode in the settings service.
   - Preserve the existing sender behavior for the two supported choices, including FlowCare fallback and clinic-specific approved message IDs.

## Technical details

- Update the Settings navigation and authenticated routes without changing the Super Admin activation workflow.
- Narrow the WhatsApp mode type and server validation to `default | own_number`.
- Remove the unused clinic-owned Twilio credential path from sender resolution while leaving stored schema columns untouched, avoiding a destructive database change.
- No current clinic settings require migration; the WhatsApp settings table currently has no saved mode rows.

## Verification

- Settings no longer displays Subscription, and active-clinic navigation does not expose its page.
- A pending clinic still reaches the approval-required screen.
- WhatsApp Settings shows exactly two choices and no Twilio account credential fields.
- Both supported choices save and test successfully; the retired mode is refused by the service.
- Type checking and the preview build complete cleanly.
