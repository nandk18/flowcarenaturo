# Ask for the Settings PIN every time

## Current behaviour
After a successful PIN entry, the gate stores an "unlocked" timestamp in the browser's session storage and treats Settings as open for the next 60 minutes. So leaving Settings and coming back does not re-prompt.

## Change
Require the PIN on every entry into Settings:

- Drop the stored unlock timestamp entirely — unlocked state lives only in component memory.
- The gate re-mounts whenever the user navigates away from `/settings/*` and comes back, so the PIN dialog appears again each time.
- Moving between settings sub-pages (Clinic Profile, Staff, Services, ...) stays unlocked during that visit, since the shell stays mounted. Leaving Settings and returning re-prompts.
- A page refresh while inside Settings also re-prompts.

## Technical
- `src/components/settings/SettingsPinGate.tsx`: remove `UNLOCK_KEY` / `UNLOCK_TTL_MS`, `isSettingsUnlocked()`, `lockSettings()` and the `sessionStorage` reads/writes; initialise `unlocked` to `false` and set it to `true` only after a successful verify or first-time PIN creation.
- No other files change (the helpers are not imported anywhere else).
