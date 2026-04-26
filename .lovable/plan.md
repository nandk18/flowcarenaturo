
## Import stethocribe codebase into this Lovable project

### Context
- Lovable does not support direct GitHub repo import. We'll bring the code in via a zip upload.
- This project is **already connected** to your Supabase project `boskgmampbfccbfpgzea` — no DB changes will be made. The full schema (patients, visits, appointments, prescriptions, lab_orders, lab_results, clinics, doctors, profiles, user_roles, etc.) is preserved as-is.
- Lovable Cloud secrets are already in place (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LOVABLE_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.).

### What you do
After approving this plan, in your next message **upload `stethocribe.zip`** (max 20MB). If the repo is larger than 20MB, we'll split it into a few smaller zips (e.g. `src.zip`, `supabase.zip`, `public.zip`).

### What I do once the zip is uploaded

**1. Extract and inventory**
- Unpack the zip into a staging area
- Scan the structure (pages, components, hooks, lib, supabase functions, public assets, configs)
- Identify the Supabase client setup, routing entry, and any environment-variable usage

**2. Reconcile with Lovable conventions**
- Keep Lovable's existing `src/integrations/supabase/client.ts` and `src/integrations/supabase/types.ts` (auto-generated — won't overwrite)
- Replace any custom Supabase client init with imports from `@/integrations/supabase/client`
- Map `process.env.*` / `import.meta.env.VITE_SUPABASE_*` references onto Lovable's auto-injected env
- Preserve Lovable's `App.tsx` providers (QueryClient, Tooltip, Toasters, Router) and merge stethocribe's routes into the existing `<Routes>`
- Keep Lovable's shadcn `src/components/ui/*` — drop incoming UI primitives that duplicate them

**3. Copy files in this order (everything as-is, fix later)**
1. `package.json` deps → merge missing dependencies into Lovable's `package.json`
2. `tailwind.config.ts`, `index.css`, `postcss.config.js` → merge tokens/theme additions
3. `src/lib/**`, `src/utils/**`, `src/types/**`
4. `src/hooks/**` (skip duplicates of `use-mobile`, `use-toast`)
5. `src/components/**` (excluding `ui/`)
6. `src/pages/**` and route wiring in `App.tsx`
7. `public/**` assets
8. `supabase/functions/**` edge functions (auto-deploy)
9. `supabase/config.toml` — merge function config only (no DB migrations)

**4. Fix-up pass**
- Resolve broken imports / path aliases (`@/...`)
- Remove or stub anything depending on a backend feature that doesn't exist in your schema
- TypeScript: address blocking errors; non-blocking warnings noted but left
- Confirm app boots, login screen renders, and at least one Supabase query succeeds against your existing data

**5. Status report**
After the import I'll list:
- Files imported, files skipped (with reason), files needing follow-up
- Any routes/pages currently broken and why
- Suggested next steps (e.g. "wire up auth flow", "fix prescriptions page imports")

### Out of scope
- No new DB tables, columns, RLS policies, triggers, or migrations
- No edits to `src/integrations/supabase/types.ts`
- No GitHub repo connection (separate action — you can do that later via Connectors → GitHub)

### Ready check
Approve this plan, then upload `stethocribe.zip` in your next message.
