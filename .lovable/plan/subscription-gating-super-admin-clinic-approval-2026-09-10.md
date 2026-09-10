# Subscription gating & Super Admin clinic approval

## Requirements (resolved)

- New clinics must start **inactive/pending** and only become usable after a Super Admin enables them.
- Every approved clinic gets a **7-day free trial**.
- After the trial, clinics must subscribe to a paid plan (monthly or annual).
- Primary market: **India first**, global later.
- Pricing model: a base clinic fee + a patient-count component.
- Plan tiers:
  - **Pro** — core practice management without the Treatment module.
  - **Custom** — includes the Treatment module (and any future premium modules).
- Super Admin can still disable a clinic at any time.

## Recommended payment stack

**Razorpay (direct, bring-your-own API keys)** is the best fit for India-first SaaS: UPI, NetBanking, cards, subscriptions, GST-compliant invoices, and INR pricing. It is not a built-in Lovable Payments provider, so it is integrated as a custom Edge Function using your Razorpay key/secret.

Alternative: if you already use **Chargebee**, its Lovable connector can manage plans/trials and route charges through Razorpay. That adds a second vendor; Razorpay alone is simpler for the first release.

## Implementation plan

### 1. Database changes

Add subscription fields to `public.clinics`:

```text
- subscription_status      text    -- 'pending' | 'trial' | 'active' | 'past_due' | 'cancelled' | 'disabled'
- plan_tier                text    -- 'pro' | 'custom'
- billing_cycle            text    -- 'monthly' | 'annual'
- trial_starts_at          timestamptz
- trial_ends_at            timestamptz
- subscription_starts_at   timestamptz
- subscription_ends_at     timestamptz
- razorpay_customer_id     text
- razorpay_subscription_id text
- max_patients_allowed     int     -- enforced after trial
- invoice_region           text    -- 'IN' initially
```

Add `GRANT` statements and RLS policies so only authenticated admin/super_admin roles and service_role can read/update these columns.

### 2. Super Admin approval gate

- Change the clinic creation default so `is_active = false` and `subscription_status = 'pending'`.
- Update the `complete_clinic_onboarding` RPC (or add a new post-onboarding hook) to leave the clinic in `pending` state.
- In `authRedirect.ts`, `useAuth.tsx`, and `Auth.tsx`, block login/dashboard access for any clinic where `is_active = false` or `subscription_status = 'pending'`, showing a "waiting for activation" message.
- In `SuperAdmin.tsx`, add an **Activate** action that:
  - Sets `is_active = true`
  - Sets `subscription_status = 'trial'`
  - Sets `trial_starts_at = now()` and `trial_ends_at = now() + interval '7 days'`
  - Optionally creates the Razorpay customer record.
- Keep the existing **Disable** action; disabling sets `is_active = false` and records a reason.

### 3. Subscription plans & Razorpay checkout

Create Razorpay plans/items:

```text
Pro Monthly     — base clinic fee
Pro Annual      — base clinic fee with ~2-month discount
Custom Monthly  — base clinic fee + Treatment module
Custom Annual   — base clinic fee + Treatment module with discount
Patient overage — per-patient add-on (optional usage-based item)
```

Add a new Edge Function `razorpay-checkout`:

- Accepts `clinic_id`, `plan_tier`, `billing_cycle`.
- Verifies the caller is the admin of that clinic and the clinic is in trial or active status.
- Creates/updates a Razorpay customer and subscription.
- Returns Razorpay checkout options (`subscription_id`, `prefill`, etc.) to the frontend.

Add a `/billing` page (or a billing section in Settings) where admins see:

- Current trial countdown.
- Current plan and patient count.
- Pro / Custom toggle.
- Monthly / Annual toggle.
- Razorpay checkout button.

### 4. Webhook & status sync

Add an Edge Function `razorpay-webhook`:

- Receives Razorpay subscription events (`subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`).
- Verifies webhook signature using the Razorpay webhook secret.
- Updates `clinics.subscription_status`, `subscription_starts_at`, `subscription_ends_at`, `plan_tier`, and `billing_cycle`.
- Adds an audit log entry for each billing event.

### 5. Patient-count billing enforcement

- Add `clinics.max_patients_allowed` based on the chosen plan/tier.
- On new patient creation, if the clinic is post-trial and has exceeded its patient limit, block the insert and surface a message to upgrade.
- Add a Super Admin or automated job that updates `max_patients_allowed` when a subscription changes.

### 6. In-app subscription enforcement

- In `useAuth` and route guards, if `subscription_status` is `trial` and `trial_ends_at` has passed, redirect to `/billing` with a banner.
- If `subscription_status` is `past_due`, `cancelled`, or `disabled`, redirect to a locked/billing page.
- Hide the Treatment module UI for Pro plans; show it only for Custom.

### 7. Razorpay credentials & secrets

Store as Edge Function secrets:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Frontend uses only the key ID for Razorpay Checkout; all charge/subscription creation happens server-side in the Edge Function.

## Out of scope (unless you ask)

- International pricing/currency (USD/EUR). Add when you expand globally.
- Automatic invoice emailing from Razorpay (Razorpay can handle this; just enable in dashboard).
- Per-user/doctor pricing (current model is clinic + patients).
- Detailed revenue analytics in Super Admin (can be added once subscription data is flowing).

## First step if approved

Add the `clinics` subscription columns and change the default clinic state to pending/inactive, then update the Super Admin dashboard with the Activate action and the trial timer.
