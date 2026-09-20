# Fix 404 on Settings > Subscription

## Cause
`/subscription` is registered as a route only inside the "subscription issue" fallback block in `src/App.tsx` (line 332), which renders only when a clinic is past due/expired. Normal signed-in admins never get that route, so the Subscription link in Settings (`SettingsShell.tsx` line 47) falls through to the catch-all and shows 404.

## Fix (one file)
In `src/App.tsx`, add to the main authenticated admin route block:

```text
<Route path="/subscription" element={<SubscriptionPage />} />
```

- `SubscriptionPage` is already imported and renders its own full layout, so no shell wrapper is needed.
- The existing fallback-block route stays untouched; expired/past-due clinics keep their lock screen.

## Verify
- Open `/subscription` from Settings as a normal admin — page loads instead of 404.
- `tsgo --noEmit` and `/tmp/observability/build-errors.log` clean.
