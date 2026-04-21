# StethoScribe — Technical Reference

## 1. Project Overview

| Component | Technology |
|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| AI — Speech-to-Text | OpenAI Whisper (`whisper-1`) |
| AI — SOAP Formatting | Anthropic Claude (`claude-opus-4-5`) |
| AI — Template Reformatting | Anthropic Claude (`claude-sonnet-4-20250514`) |
| AI — Name Transliteration | Anthropic Claude (`claude-haiku-4-5-20251001`) |
| Hosting — Frontend | Lovable |
| Hosting — Backend | Supabase Cloud |
| Mobile | Capacitor (app ID: `com.stethoscribe.app`) |
| Charts | Recharts |
| Live URL | https://stethoscribe.lovable.app |

---

## 2. Project Structure

```
├── index.html                          — HTML entry point with meta tags and cache-busting headers
├── capacitor.config.ts                 — Capacitor native app config (com.stethoscribe.app)
├── vite.config.ts                      — Vite build config
├── tailwind.config.ts                  — Tailwind theme with custom design tokens
├── tsconfig.json / tsconfig.app.json   — TypeScript configs
├── public/
│   ├── _redirects                      — SPA routing for deployment (/* → /index.html 200)
│   ├── robots.txt                      — Search engine crawler config
│   ├── favicon.ico                     — App favicon
│   └── placeholder.svg                 — Placeholder image
├── src/
│   ├── App.tsx                         — Main router with all route definitions and auth gating
│   ├── main.tsx                        — React entry point (ReactDOM.createRoot)
│   ├── index.css                       — Global styles, CSS variables, design tokens
│   ├── App.css                         — Additional app-level styles
│   ├── lib/
│   │   └── utils.ts                    — cn() utility for Tailwind class merging
│   ├── hooks/
│   │   ├── useAuth.tsx                 — AuthProvider + useAuth hook (session, profile, role)
│   │   ├── useClinic.tsx               — Clinic + doctor data fetching hook
│   │   ├── use-mobile.tsx              — Mobile viewport detection hook
│   │   └── use-toast.ts               — Toast notification hook
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts               — Supabase client initialization (auto-generated)
│   │       └── types.ts                — Generated TypeScript types from DB schema
│   ├── components/
│   │   ├── NavLink.tsx                 — Active-aware navigation link component
│   │   ├── layout/
│   │   │   └── DashboardLayout.tsx     — Sidebar + mobile hamburger layout shell
│   │   ├── ui/                         — shadcn/ui base components (button, card, dialog, etc.)
│   │   ├── doctor/
│   │   │   ├── ConsultationWorkspace.tsx — 6-tab consultation UI (Summary, History, Voice, SOAP, Rx, Docs)
│   │   │   ├── VoiceRecorder.tsx       — Audio recording with waveform + Whisper integration
│   │   │   ├── PatientHistory.tsx      — Past visits timeline component
│   │   │   ├── DocumentsTab.tsx        — File upload/view/delete for visit documents
│   │   │   ├── EMRExportButtons.tsx    — Plain Text / FHIR JSON / CSV export buttons
│   │   │   ├── PrescriptionShareModal.tsx — WhatsApp/Email/Copy/Download/Print sharing modal
│   │   │   └── TemplateSelector.tsx    — Template dropdown with AI reformat on switch
│   │   └── receptionist/
│   │       ├── PatientRegistration.tsx  — Patient search + registration form
│   │       └── TodayQueue.tsx          — Queue list with patient cards and actions
│   └── pages/
│       ├── Auth.tsx                     — Login/signup page with role selector
│       ├── AcceptInvite.tsx            — Invited staff activation page
│       ├── ForgotPassword.tsx          — Password reset request page
│       ├── ResetPassword.tsx           — Set new password page
│       ├── Onboarding.tsx              — Clinic setup wizard
│       ├── Index.tsx                    — Landing redirect
│       ├── AdminDashboard.tsx          — Admin dashboard with reception + doctor views
│       ├── DoctorDashboard.tsx         — Doctor queue view
│       ├── DoctorConsultationPage.tsx  — Consultation workspace page wrapper
│       ├── ReceptionistDashboard.tsx   — Receptionist queue + registration
│       ├── PatientsPage.tsx            — Patient list with search
│       ├── PatientDetailPage.tsx       — Patient history + detail page
│       ├── TemplatesPage.tsx           — Template library and enabled templates
│       ├── AnalyticsPage.tsx           — Admin analytics dashboard with charts
│       ├── Settings.tsx                — Clinic, doctor profile, security, staff management
│       ├── PrescriptionViewer.tsx      — Public prescription viewer at /rx/:id
│       └── NotFound.tsx                — 404 page
└── supabase/
    ├── config.toml                     — Supabase project config (auto-generated)
    └── functions/
        ├── transcribe-audio/index.ts   — OpenAI Whisper speech-to-text
        ├── format-soap-notes/index.ts  — Claude SOAP formatting from transcript
        ├── reformat-notes/index.ts     — Claude template reformatting
        ├── generate-prescription-pdf/index.ts — HTML prescription generation with bilingual headers
        └── invite-staff/index.ts       — Admin staff invitation via Supabase Auth
```

---

## 3. Database Schema

### clinics

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| name | TEXT | NO | — | Clinic display name |
| address | TEXT | YES | NULL | Full address |
| phone | TEXT | YES | NULL | Contact number |
| logo_url | TEXT | YES | NULL | Uploaded logo path in storage |
| letterhead_url | TEXT | YES | NULL | Custom letterhead image path |
| onboarding_complete | BOOLEAN | YES | false | Whether setup wizard completed |
| regional_language | TEXT | YES | NULL | Selected language for bilingual prescriptions |
| prescription_template | TEXT | YES | NULL | Default prescription layout name |
| created_at | TIMESTAMPTZ | YES | now() | Auto-generated timestamp |

### profiles

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| user_id | UUID | NO | — | References auth.users(id) |
| clinic_id | UUID | YES | NULL | FK → clinics(id) |
| full_name | TEXT | YES | NULL | Display name |
| role | app_role ENUM | NO | 'admin' | admin / doctor / receptionist |
| created_at | TIMESTAMPTZ | YES | now() | Auto-generated |

### user_roles

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| user_id | UUID | NO | — | References auth.users(id) ON DELETE CASCADE |
| role | app_role ENUM | NO | — | admin / doctor / receptionist |

Unique constraint on (user_id, role).

### doctors

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| clinic_id | UUID | NO | — | FK → clinics(id) |
| user_id | UUID | NO | — | Linked auth user |
| name | TEXT | NO | — | Doctor display name |
| qualification | TEXT | YES | NULL | e.g., MBBS MD |
| registration_number | TEXT | YES | NULL | Medical council registration |
| specialty | TEXT | YES | NULL | e.g., General Medicine |
| signature_url | TEXT | YES | NULL | Signature image path in storage |
| availability | TEXT | YES | NULL | Schedule data |
| default_template_id | UUID | YES | NULL | FK → note_templates(id) |
| default_template | TEXT | YES | NULL | Last used template name |
| enabled_templates | TEXT[] | YES | NULL | Array of enabled template names |
| created_at | TIMESTAMPTZ | YES | now() | Auto-generated |

### patients

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| clinic_id | UUID | NO | — | FK → clinics(id) |
| name | TEXT | NO | — | Full name (legacy, also used as display) |
| first_name | TEXT | YES | NULL | First name |
| last_name | TEXT | YES | NULL | Last name |
| healthcare_id | TEXT | YES | NULL | Auto-generated MED-YYYY-XXXXX format |
| dob | TEXT | YES | NULL | Date of birth |
| gender | TEXT | YES | NULL | male / female / other |
| phone | TEXT | YES | NULL | Contact phone |
| email | TEXT | YES | NULL | Email address |
| blood_group | TEXT | YES | NULL | Blood group |
| allergies | JSONB | YES | NULL | Array of allergy strings |
| chronic_conditions | JSONB | YES | NULL | Array of condition strings |
| created_at | TIMESTAMPTZ | YES | now() | Auto-generated |

### visits

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| clinic_id | UUID | NO | — | FK → clinics(id) |
| patient_id | UUID | NO | — | FK → patients(id) |
| doctor_id | UUID | YES | NULL | FK → doctors(id), assigned when consultation starts |
| visit_date | TEXT | YES | NULL | Date of visit |
| token_number | INTEGER | NO | — | Queue position for the day |
| status | TEXT | YES | 'waiting' | waiting / in_progress / completed / cancelled |
| chief_complaint | TEXT | YES | NULL | Reason for visit |
| vitals | JSONB | YES | NULL | {bp_sys, bp_dia, pulse, temp, spo2, weight, height} |
| created_by | UUID | YES | NULL | Who created the visit |
| created_at | TIMESTAMPTZ | YES | now() | Auto-generated |

### clinical_notes

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| visit_id | UUID | NO | — | FK → visits(id) |
| doctor_id | UUID | NO | — | FK → doctors(id) |
| raw_transcript | TEXT | YES | NULL | Original voice transcript |
| soap_notes | JSONB | YES | NULL | Dynamic fields based on template. Includes _template key |
| language_detected | TEXT | YES | NULL | Language detected by Whisper |
| audio_url | TEXT | YES | NULL | Path in audio-recordings storage bucket |
| created_at | TIMESTAMPTZ | YES | now() | Auto-generated |

### prescriptions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| visit_id | UUID | NO | — | FK → visits(id) |
| doctor_id | UUID | NO | — | FK → doctors(id) |
| medications | JSONB | YES | NULL | Array of {name, dosage, morning, afternoon, evening, night, duration, notes} |
| investigations | JSONB | YES | NULL | Array of investigation strings |
| follow_up_date | TEXT | YES | NULL | Next appointment date |
| notes | TEXT | YES | NULL | Additional instructions |
| pdf_url | TEXT | YES | NULL | Path in prescriptions storage bucket |
| created_at | TIMESTAMPTZ | YES | now() | Auto-generated |

### note_templates

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| clinic_id | UUID | YES | NULL | FK → clinics(id). NULL for system templates |
| name | TEXT | NO | — | Template display name |
| description | TEXT | YES | NULL | Template description |
| is_system | BOOLEAN | YES | false | True = available to all clinics |
| sections | JSONB | NO | '[]' | Array of section definition objects |
| created_at | TIMESTAMPTZ | YES | now() | Auto-generated |

### patient_documents

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| visit_id | UUID | YES | NULL | FK → visits(id) |
| patient_id | UUID | YES | NULL | FK → patients(id) |
| clinic_id | UUID | YES | NULL | FK → clinics(id) |
| uploaded_by | UUID | NO | — | Who uploaded the file |
| file_name | TEXT | NO | — | Original filename |
| file_url | TEXT | NO | — | Path in patient-documents storage bucket |
| file_size | INTEGER | YES | NULL | File size in bytes |
| file_type | TEXT | YES | NULL | MIME type |
| created_at | TIMESTAMPTZ | YES | now() | Auto-generated |

### document_shares

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| prescription_id | UUID | NO | — | FK → prescriptions(id) |
| shared_via | TEXT | NO | — | whatsapp / email / sms / download |
| recipient | TEXT | YES | NULL | Phone number or email |
| shared_at | TIMESTAMPTZ | YES | now() | When shared |

---

## 4. Database Functions

### `get_user_clinic_id(user_uuid UUID) → UUID`
- **Security**: SECURITY DEFINER, STABLE
- **Purpose**: Returns the clinic_id for any authenticated user by looking up their profiles row
- **Used in**: All RLS policies to isolate data by clinic

### `has_role(_user_id UUID, _role app_role) → BOOLEAN`
- **Security**: SECURITY DEFINER, STABLE
- **Purpose**: Checks if a user has a specific role in the user_roles table
- **Used in**: RLS policies for role-based access control

### `complete_clinic_onboarding(p_clinic_name TEXT, p_clinic_address TEXT, p_clinic_phone TEXT) → UUID`
- **Purpose**: Atomically creates a clinic record and links the calling user's profile to it
- **Called from**: Onboarding wizard

### `handle_new_user() → TRIGGER`
- **Trigger**: AFTER INSERT on auth.users
- **Purpose**: Auto-creates profiles and user_roles row for every new signup
- **Behavior**: Reads `invited_role` and `invited_clinic_id` from user metadata for invited staff

### Healthcare ID Generation (Trigger)
- **Trigger**: BEFORE INSERT on patients
- **Purpose**: Auto-generates `MED-YYYY-XXXXX` format healthcare ID
- **Format**: `MED` + current year + 5-digit zero-padded sequence per clinic

---

## 5. Row Level Security Policies

All tables use `get_user_clinic_id(auth.uid())` for clinic-level data isolation.

| Table | Policy Summary |
|-------|---------------|
| clinics | INSERT open for new clinics; SELECT/UPDATE restricted to clinic members |
| profiles | SELECT/UPDATE/INSERT filtered by `user_id = auth.uid()` |
| patients | All CRUD operations filtered by `clinic_id = get_user_clinic_id(auth.uid())` |
| visits | All CRUD operations filtered by clinic_id |
| clinical_notes | All CRUD operations filtered by clinic_id (via visit join) |
| prescriptions | CRUD filtered by clinic; additional public SELECT policy for `anon` role (prescription viewer) |
| doctors | All operations filtered by clinic_id |
| note_templates | SELECT allows `is_system = true` OR clinic_id match |
| patient_documents | All operations filtered by clinic_id |
| document_shares | INSERT/SELECT filtered by prescription ownership |
| user_roles | Managed via security definer functions |

---

## 6. Storage Buckets

| Bucket | Public | Purpose | Path Format |
|--------|--------|---------|-------------|
| clinic-assets | Yes | Clinic logos, letterheads | `/{clinic_id}/logo.png` |
| signatures | No | Doctor signature images | `/{doctor_id}/signature.png` |
| prescriptions | No | Generated prescription HTML files | `/{clinic_id}/{year}/{prescription_id}.html` |
| audio-recordings | No | Voice recordings from consultations | `/{clinic_id}/{visit_id}/audio.webm` |
| patient-documents | No | Uploaded scans and documents | `/{clinic_id}/{patient_id}/{visit_id}/{filename}` |

---

## 7. Edge Functions

### `transcribe-audio`
- **Method**: POST
- **Auth**: Required (anon key in Authorization header)
- **Input**: `multipart/form-data` with audio file field
- **Process**: Sends audio to OpenAI Whisper API (`whisper-1` model)
- **Output**: `{transcript: string}`
- **Language**: Currently hardcoded to `"en"` but Whisper handles multilingual audio
- **Audio format**: WebM/Opus from MediaRecorder API
- **Error handling**: Returns specific error codes for invalid key (`invalid_key`), no credits (`no_credits`), and API errors (`api_error`)

### `format-soap-notes`
- **Method**: POST
- **Auth**: Required
- **Input**: `{transcript, patient_context, template_name, template_sections[]}`
- **Process**: Sends to Claude `claude-opus-4-5` with dynamic template-aware system prompt
- **Output**: JSON with fields matching template sections + `medications[]` + `investigations[]` + `icd_suggestions[]` + `follow_up_days`
- **System prompt**: Instructs Claude to act as medical scribe for Indian outpatient clinics, accepts dictation in any Indian language, outputs in English
- **Model**: `claude-opus-4-5`

### `reformat-notes`
- **Method**: POST
- **Auth**: Required
- **Input**: `{existing_content: string, new_template_name: string, field_definitions: [{key, label, placeholder}]}`
- **Process**: Claude reformats existing clinical content to match new template structure
- **Output**: JSON with fields matching the target template's field definitions
- **Model**: `claude-sonnet-4-20250514`

### `generate-prescription-pdf`
- **Method**: POST
- **Auth**: Required (uses service role key internally)
- **Input**: `{visit_id, prescription_id}`
- **Process**:
  1. Fetches visit, patient, doctor, clinic, clinical_notes, prescriptions from DB
  2. Calls Claude Haiku (`claude-haiku-4-5-20251001`) to transliterate clinic name and doctor name into regional script
  3. Builds HTML with Google Noto fonts for all Indian scripts
  4. Uploads HTML to `prescriptions` storage bucket
  5. Updates `prescriptions.pdf_url` with the storage path
- **Output**: `{success: true, path: string}`
- **Regional language support**: Reads `clinic.regional_language`, uses `TRANSLATIONS` map for 15 Indian languages with bilingual labels for clinic, doctor, patient, date, prescription, follow-up, morning/afternoon/evening/night, investigations, and clinical notes

### `invite-staff`
- **Method**: POST
- **Auth**: Required (admin role only)
- **Input**: `{email, role}`
- **Process**:
  1. Verifies caller is admin via profile lookup
  2. If user already exists in auth: links to clinic via profiles upsert, creates user_roles entry, optionally creates doctors record
  3. If new user: calls `supabase.auth.admin.inviteUserByEmail` with metadata
  4. Pre-creates profile record so team list shows pending member immediately
- **redirectTo**: `https://stethoscribe.lovable.app/accept-invite`
- **Metadata passed**: `invited_role`, `invited_clinic_id`, `invited_clinic_name`, `invited_by`

---

## 8. Authentication Flow

- **Provider**: Supabase Auth (email + password)
- **Login page**: `/auth` — email, password, role selector (Admin/Doctor/Receptionist)
- **After login**: Reads profile from `profiles` table to get role and clinic_id
- **Routing by role**:
  - `admin` → `/dashboard` (full access: analytics, templates, settings, consultations)
  - `doctor` → `/dashboard` (queue, consultations, templates)
  - `receptionist` → `/dashboard` (queue, patients only)
- **Invite flow**: Admin sends invite → staff receives email → clicks link → `/accept-invite` → sets name + password → redirected to `/auth`
- **Password reset**: `/forgot-password` → email sent → `/reset-password` → set new password
- **Session management**: `useAuth` hook wraps `supabase.auth.onAuthStateChange` and provides `session`, `user`, `profile`, `loading`, `signOut`

---

## 9. AI Integration

### OpenAI Whisper
- **Used for**: Voice transcription in consultation Voice tab
- **Model**: `whisper-1`
- **Language**: Set to `"en"` in edge function but Whisper handles multilingual input
- **Supports**: Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Urdu, English + code-switching
- **Audio format**: WebM/Opus from `MediaRecorder` API
- **Edge function**: `transcribe-audio`

### Anthropic Claude
| Model | Usage | Purpose |
|-------|-------|---------|
| `claude-opus-4-5` | `format-soap-notes` | SOAP note formatting from voice transcript |
| `claude-sonnet-4-20250514` | `reformat-notes` | Template reformatting when doctor switches templates |
| `claude-haiku-4-5-20251001` | `generate-prescription-pdf` | Name transliteration for bilingual prescription headers |

### Template-Aware AI Formatting
1. Doctor selects template before or after recording
2. Template name and section/field keys sent to `format-soap-notes`
3. Claude returns JSON with exactly those fields
4. If template is switched after notes exist, `reformat-notes` is called to restructure content

---

## 10. Frontend Architecture

### Key React Patterns

- **`useAuth` hook**: Provides `session`, `user`, `profile` (with role), `loading`, `signOut`
- **`useClinic` hook**: Provides `clinic` details (name, address, phone, language) and `doctor` profile for the current user
- **Role-based rendering**: `role === "admin" || role === "doctor"` pattern throughout components
- **Tanstack Query**: `QueryClient` initialized in App for data fetching (available but Supabase direct calls are used more)

### Routing Structure

```
/                                → redirects to /auth or /dashboard
/auth                            → login/signup page (public)
/forgot-password                 → password reset request (public)
/reset-password                  → set new password (public)
/accept-invite                   → staff activation (public)
/rx/:prescriptionId              → prescription viewer (public, no auth)
/onboarding                      → clinic setup wizard (auth required, no clinic)
/dashboard                       → role-based dashboard (protected)
/dashboard/patients              → patient list (protected)
/dashboard/patients/:patientId   → patient detail + history (protected)
/dashboard/templates             → template library (doctor + admin)
/dashboard/analytics             → analytics dashboard (admin only)
/dashboard/settings              → settings (all roles, sections vary by role)
/dashboard/consultation/:visitId → consultation workspace (doctor + admin)
```

### Consultation Workspace Tabs
1. **Summary** — patient demographics, vitals, allergies, chronic conditions
2. **History** — past visits with SOAP notes and prescriptions
3. **Voice** — MediaRecorder → Whisper → Claude → auto-populate SOAP fields
4. **SOAP** — dynamic template fields, template selector dropdown, AI reformat on switch
5. **Rx** — medication table with M/A/E/N checkboxes, investigations, follow-up date
6. **Docs** — file upload to `patient-documents` storage bucket

### DashboardLayout
- Sidebar with role-specific navigation links
- Mobile: hamburger menu with overlay sidebar
- Displays clinic name and user profile at bottom
- Sign out button

---

## 11. Environment Variables

### Frontend (.env — auto-generated, do not edit)
```
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon key]
VITE_SUPABASE_PROJECT_ID=[project-id]
```

### Edge Function Secrets (set in Supabase Dashboard → Edge Functions → Secrets)
```
ANTHROPIC_API_KEY=[Anthropic Claude API key]
OPENAI_API_KEY=[OpenAI API key]
SUPABASE_URL=[project URL]
SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service role key]
```

---

## 12. Mobile / Native App

- **Capacitor** installed: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/share`, `@capacitor/haptics`
- **App ID**: `com.stethoscribe.app`
- **Web directory**: `dist`

### Build Steps
1. Export project from Lovable to GitHub
2. Clone locally
3. Run: `npm install`
4. Run: `npm run build`
5. Run: `npx cap sync`
6. Open in Android Studio (`android/`) or Xcode (`ios/`)
7. Build and deploy to device

---

## 13. Known Limitations

- **PDF generation** uses HTML + Noto fonts (not true PDF binary) — browser renders and prints to PDF via `window.print()`
- **Voice recording** requires HTTPS (works on deployed URL, not localhost without setup)
- **Whisper language** is hardcoded to `"en"` in the edge function — Whisper still handles multilingual audio but explicit language detection could improve accuracy
- **Template reformatting** uses Claude API from edge function — adds ~2-3 seconds latency on template switch
- **Supabase free tier limits**: 500MB database, 1GB storage, 50MB edge function execution
- **Supabase query limit**: Default 1000 rows per query — may affect clinics with very large datasets
- **Prescription viewer** relies on signed URLs (7-day expiry by default) — if the prescription HTML file is deleted from storage, the viewer will show an error

---

## 14. Future Development Suggestions

- Appointment scheduling with calendar view
- SMS integration via Twilio for prescription sharing
- ABDM (Ayushman Bharat Digital Mission) integration for national health ID linking
- Offline mode with service worker for poor connectivity areas
- Doctor signature capture (canvas-based) and embed in prescription
- Clinic logo upload and display on prescription header
- Bulk patient import via CSV upload
- WhatsApp Business API integration (vs current wa.me links)
- Insurance claim generation
- Lab result upload and parsing
- Multi-branch clinic support with inter-branch referrals
- Appointment reminders via SMS/WhatsApp
- Drug interaction checking
- ICD-10 code suggestion from AI assessment
- Patient portal for viewing their own records
