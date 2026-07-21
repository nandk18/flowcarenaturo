# Super Admin: All-Clinic Analytics + Access Toggle

Currently there are **zero** super_admin accounts in the database, and the `clinics` table has no "active/disabled" flag. Super admin routes already exist (`/super-admin`, `/super-admin/analytics`) but the dashboard doesn't yet show activity per clinic or let you disable clinics.

## 1. Create the first super admin

Since there are no super admins yet, the only safe way to create one is via a database migration that promotes an existing signed-up user.

Flow:

- You sign up normally at `/auth` with the email you want to use as super admin (e.g. `you@flowcare.com`).
- I run a migration that flips that user's `profiles.role` and `user_roles.role` to `super_admin`, and clears their `clinic_id` so they aren't tied to any clinic.
- On next login, `authRedirect.ts` already routes `super_admin` to `/super-admin`.

I'll ask you for the exact email before running the migration.

## 2. Add "disabled" flag to clinics

New migration:

- Add `clinics.is_active boolean not null default true` and `disabled_at timestamptz`, `disabled_reason text`.
- Add RLS: only `super_admin` can update these columns.
- Add a login gate: in `src/lib/authRedirect.ts` and `src/hooks/useAuth.tsx`, if the signed-in admin's `clinic.is_active = false`, sign them out and redirect to `/login?reason=clinic_disabled` with a friendly banner in `Auth.tsx`.
- Therapist login (`verify_therapist_pin` RPC) also rejects when the clinic is disabled.

## 3. Rebuild Super Admin dashboard

Rewrite `src/pages/SuperAdmin.tsx` around a **per-clinic activity table** (replacing the current labs-first layout):

```text
Clinic              Status    Users  Patients  Visits(7d)  Appts(7d)  Revenue(30d)  Last active     Actions
─────────────────────────────────────────────────────────────────────────────────────────────────────────────
Naturo Wellness     ● Active    5     342        87           64        ₹1,24,500     2m ago         [Analytics] [Disable]
Green Leaf Clinic   ○ Disabled  3     120        0            0         ₹0            3d ago         [Analytics] [Enable]
```

- One row per clinic with live counters (patients, visits last 7d, appointments last 7d, revenue last 30d, last audit-log timestamp = "what they're doing now").
- Status pill driven by `is_active`.
- **Single-click toggle**: an "Enable/Disable" button calls a new `super_admin_set_clinic_active(clinic_id, active, reason)` RPC (SECURITY DEFINER, checks `has_role(auth.uid(), 'super_admin')`). Confirms via a small dialog when disabling.
- "Analytics" button opens the existing `/super-admin/analytics/:clinicId` drill-down (already built).

## 4. "What are they doing" live feed

Add a second tab **Live Activity** on the super admin dashboard:

- Reads the existing `audit_logs` table across all clinics (already global), joined with `clinics.name`.
- Shows the last 100 events with clinic, user, action, resource, timestamp.
- Filter dropdown by clinic and by action type.
- Auto-refresh every 30s.

## Technical details

**Migration 1 — promote user + clinic flag:**

```sql
alter table public.clinics
  add column if not exists is_active boolean not null default true,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text;

create policy "Super admin can update clinic status"
  on public.clinics for update
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

create or replace function public.super_admin_set_clinic_active(
  p_clinic_id uuid, p_active boolean, p_reason text default null
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'super_admin') then
    raise exception 'Super admin required';
  end if;
  update public.clinics
     set is_active = p_active,
         disabled_at = case when p_active then null else now() end,
         disabled_reason = case when p_active then null else p_reason end
   where id = p_clinic_id;
end $$;
grant execute on function public.super_admin_set_clinic_active(uuid,boolean,text) to authenticated;
```

**Migration 2 — promote your user (run after you tell me the email):**

```sql
update public.profiles set role='super_admin', clinic_id=null
 where user_id=(select id from auth.users where email='<YOUR_EMAIL>');
insert into public.user_roles(user_id, role)
 select id, 'super_admin' from auth.users where email='<YOUR_EMAIL>'
 on conflict (user_id, role) do nothing;
```

**Migration 3 — clinic-summary RPC** for the dashboard table (aggregates counts + last audit timestamp per clinic in a single query).

**Frontend files touched:**

- `src/pages/SuperAdmin.tsx` — rebuild with Clinics table + Live Activity tab + disable toggle.
- `src/lib/authRedirect.ts` + `src/pages/Auth.tsx` — block sign-in for disabled clinics.
- `src/hooks/useAuth.tsx` — re-check `is_active` on session load and sign out if flipped.

## Open question before I start

**What email should become the first super admin?** (It must be an account you've already signed up with at `/auth`, or I can create it now via Supabase Auth admin — either works, just tell me which.)  -> nandhakice@gmail.com