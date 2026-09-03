# FlowCare — User Guide & Use Cases

Everything your clinic team can do in FlowCare, screen by screen. Written for a brand-new user: the receptionist on day one, the doctor running consultations, the therapist on the floor, and the owner watching the numbers.

**Live app:** https://flowcarenaturo.lovable.app

---

## 1. What FlowCare is

FlowCare is a single system for running an outpatient clinic that treats patients over multiple visits — consultations *and* therapy sessions.

It covers:

- **Patients & leads** — enquiries, follow-up attempts, full patient profiles
- **Appointments** — multi-doctor calendar with day / week / month views
- **Consultations** — voice-dictated clinical notes, templates, prescriptions, EMR export
- **Treatments** — treatment plans, a live therapy board, a separate therapist mobile app
- **Daily Ops** — call tasks, care calls, to-do list, pending invoices
- **Billing** — invoices, services & store items, payments, shareable invoice links
- **Analytics** — revenue, patients, appointments, leads, treatments, therapists
- **WhatsApp automation** — booking confirmations, reminders, review requests, lapsed-patient follow-ups

Everything is clinic-scoped: your staff only ever see your clinic's data.

![The FlowCare marketing site — where new clinics sign up.](/guide-screenshots/landing.png)

---

## 2. Getting started

### 2.1 Creating your clinic account

1. Open the site and click **Sign up**.
2. Enter **Full Name**, **Email** and a **Password** (minimum 6 characters), and accept the Terms & Privacy checkbox.
3. Verify your email from the confirmation link.
4. Log in.

> Only **admin** and **super admin** accounts can log in to the web app. Therapists do not use email/password — they use a PIN in their own app (see §8).

![The login / sign-up screen. Forgot-password is on the same card.](/guide-screenshots/login.png)

### 2.2 Onboarding wizard

Straight after the first login you complete a 4-step wizard:

| Step | What you enter |
|---|---|
| 1. Clinic Details | Clinic name (required), address, phone |
| 2. Doctor Profile | Name (required), qualification, specialty, registration number |
| 3. E-signature | Coming soon — skip |
| 4. Finish | Accept the Data Processing Agreement |

Once saved, the clinic is marked onboarded and you land on the **Clinical dashboard**. Until it is complete, every route redirects back here.

### 2.3 Adding your team

Go to **Settings → Staff Members → Invite Staff**: enter the email, pick the role, send. The invitee gets an email, lands on the **Accept Invite** page ("You've been invited to join *{clinic}*"), sets their full name and password, and is taken straight into the dashboard.

Therapists are **not** invited here — you create them under **Treatment → Therapists** (§8.1).

### 2.4 Forgotten passwords

**Forgot password?** on the login card sends a reset email. The link opens the reset page where a new password (minimum 8 characters) is set; the user is then signed out and logs in fresh. Expired or already-used links are detected and explained on screen.

### 2.5 Installing FlowCare on a phone (PWA)

FlowCare installs as an app on the home screen — and there are **two different apps** on the same domain:

- **FlowCare** (admin/staff): open any normal page such as the dashboard, then use the browser's *Add to Home Screen* / *Install app*.
- **FlowCare Therapist**: open `/therapist-login` **first**, then install. The therapist icon and app name are distinct, so a therapist's phone gets the therapist app, not the admin one.

The manifest switches automatically based on the page you are on when you install, so always start from the right page.

---

## 3. Roles & navigation

### 3.1 Roles

| Role | What they get |
|---|---|
| **Admin** (doctor / owner / front desk) | The full clinic app — dashboard, patients, calendar, treatment, daily ops, billing, analytics, settings |
| **Super admin** | The platform console only (`/super-admin`) — every clinic's usage, enable/disable, WhatsApp switch, PIN reset |
| **Therapist** | PIN login into the therapist mobile app only — today's sessions, start/complete, setup photos |

### 3.2 The sidebar

- **Patients** — Patient List, Add Patient
- **Availability** — Calendar
- **Daily Ops** — call tasks + to-do list (badge shows pending care calls and un-informed cancellations)
- **Lead Pipeline** — the drag-and-drop enquiry board
- **Pending Invoices** — badge shows unpaid / partially-paid invoices
- **Treatment** (only when the treatment module is on) — Board, Therapists, Scorecards
- Footer: the gear icon opens **Settings**; your name is shown beside it

The top bar has **global search** (patient name, phone or email), the **notification bell**, and your **profile menu**.

---

## 4. Clinical dashboard — the daily home screen

Route: `/dashboard`

![Clinical dashboard: KPI tiles, Consultations / Treatments switch, and today's rows.](/guide-screenshots/dashboard.png)

**What it shows**

- Three KPI tiles: **Today's appointments** (split into consultations vs treatments), **Completed** (with a change badge), **Pending** (with the next pending time).
- An alert strip when calls are overdue or collection is pending, with a *review now* link.
- A **Consultations / Treatments** switch, each with a count, then **Active / Completed** sub-tabs.
- **Walk-in / Book appointment** button (locked to today, and it can check the patient in immediately).

**Consultation rows** show time, patient (clickable), status badge (Waiting, Scheduled, In Progress, Completed, Cancelled), doctor, service chips and reason. Actions:

- **Start Consultation** — opens Check-In (chief complaint, height, weight), creates the visit and opens the consultation workspace
- **Continue** — resume an in-progress consultation
- **View Summary** — read a completed consultation
- **Reschedule** / **Cancel** icons on active rows

**Treatment rows** carry `Booked` / `On Board` / `Completed` badges. **Start Treatment** creates the therapy sessions for that booking and takes you to the Treatment Board; **On Board** jumps to the patient's treatment tab.

The dashboard refreshes itself in real time as appointments, visits and therapy sessions change — no manual reload needed.

---

## 5. Patients

### 5.1 Patient list

`Patients → Patient List` is a searchable table of everyone in the clinic. Search by name or phone; if nothing matches, the empty state offers **Add Patient** with the search term pre-filled.

### 5.2 Adding a patient

`Patients → Add Patient` captures, in one form:

- **Lead source** — Instagram, Phone, WhatsApp, YuvaLife, Friend/Referral
- **Identity & contact** — name, phone (+91 default), email, DOB, gender, blood group, convenient call time, address
- **Emergency contact** — name, phone, relationship
- **Lifestyle** — food habits (Vegetarian / Non-Veg / Vegan / Eggetarian), smoking, alcohol, sleep hours, dinner time
- **History** — medication history, past surgery, allergies, chronic conditions

Duplicate phone numbers are detected as you type, so the same patient isn't created twice.

### 5.3 The patient profile

![The patient profile — header, glance cards, tabs and the contact timeline.](/guide-screenshots/patient-profile.png)

Header: name, a **lead-status** badge you can change (Attempt 1 / 2 / 3, Current, Closed, Lapsed) and an overflow menu with **Edit**, **Send patient-form link** (WhatsApp or copy), and **Print**.

Tabs:

- **General** — contact details, lifestyle, a contact-notes timeline with an add-note box, WhatsApp message history, and the appointment history table (with Reschedule / Cancel / Start actions). Also on this tab: the **Documents** card (upload and view files) and the **To-dos** card (tasks linked to this patient).
- **Clinical** — every past visit with its notes, prescriptions and vitals.
- **Treatment** — live plan progress (e.g. *3/6 sessions done*) and the session list.
- **Invoices** — this patient's invoices, outstanding amounts and payment actions.

---

## 6. Appointments & the calendar

Route: `Availability → Calendar`

![The multi-doctor calendar. Day, Week and Month views with per-doctor colours.](/guide-screenshots/calendar.png)

**Controls:** a **doctor multi-select** (checkbox list with coloured initials — "All doctors", "N doctors" or one name), the **Day / Week / Month** toggle, **Today**, prev/next arrows and **Book Appointment**.

- **Month** — one cell per day, tinted Off / Available / Partial / Full; click a day to drill into it.
- **Week** — slot buttons across the week.
- **Day** — one column per doctor with the slot grid; click an open slot to book, or use the chip menu on an existing appointment to open, reschedule or cancel it.

### 6.1 Booking

**Book Appointment** asks for patient (typeahead), doctor, date, time (only genuinely free slots are selectable — built from the doctor's schedule, leave exceptions and existing bookings), **services**, reason and notes.

Services decide the nature of the booking: a **consultation** service blocks the slot; **treatment** services can share a slot, so several therapy patients can run in parallel. Booking also promotes the patient's lead status to **Current** and prepares the invoice for the selected services. Booked from the dashboard as a walk-in, it goes straight into check-in.

### 6.2 Rescheduling and cancelling

- **Reschedule** — pick a new date, see that day's free slots, add an optional reason. The old appointment is closed and linked to the new one; services and the invoice carry over.
- **Cancel** — choose a reason (Patient requested / No show / Other) and add notes. Any linked unpaid invoice is cancelled, then FlowCare shows a **"Call this patient to inform them"** step with the phone number and a **Send WhatsApp** button.

---

## 7. Consultations

Opened by **Start Consultation** on the dashboard (or from the patient profile). The page shows the check-in summary — chief complaint, lifestyle, height, weight — then the workspace tabs.

| Tab | What it's for |
|---|---|
| **Summary** | Demographics, healthcare ID, blood group, chief complaint, chronic conditions |
| **History** | Every previous visit |
| **Voice** | Dictate the consultation |
| **Notes / SOAP** | The structured clinical note |
| **Rx** | Medications, investigations, follow-up |
| **Docs** | Files attached to this visit |

### 7.1 Voice notes

Tap the mic to record — you get a live waveform and a timer. On stop, the audio is transcribed and then formatted into the selected template automatically; you land on the Notes tab with the fields filled in. If you'd rather type or paste, there's a manual box with **Generate SOAP Notes with AI** / **Format Notes with AI**.

### 7.2 Notes & templates

A **template selector** sits at the top of the Notes tab and remembers the last template you used. Switching templates on a note that already has content re-formats the existing content into the new structure rather than losing it. Structured templates render one field per section; freeform templates give you a single editor.

### 7.3 Prescription

The Rx tab has a medication grid — **Drug, Dosage, Morning / Afternoon / Evening / Night checkboxes, Duration, Notes** — plus investigations, a follow-up date and prescription notes. **Order Investigation** raises a lab order (and lets you cancel one already placed).

### 7.4 Completing and sharing

**Complete Consultation** requires at least one filled note field, then it: saves the clinical note, saves the prescription, marks the visit and today's appointment completed, flags a care call if one is due, remembers your default template, and generates the prescription PDF.

The share dialog then offers **WhatsApp**, **Email**, **Copy link**, **Download** and **Print**. The link opens a public prescription viewer that needs no login.

**EMR export** is available from the same place: **Copy Text**, **FHIR JSON** (a proper FHIR bundle) and **CSV** — compatible with Practo, eVital, Meddbase and NHA ABDM.

---

## 8. Treatments

### 8.1 Setting up therapists

**Treatment → Therapists** lists every therapist with their room, colour and PIN status. **Add Therapist** captures full name (required), email, room, a colour swatch and an initial **4–8 digit PIN**. The key icon resets a PIN later.

### 8.2 Treatment plans

A plan is created from the consultation workspace (**Treatment Plan**) or from the board's **New Plan / Schedule Therapy**. Once a plan exists, each booked treatment consumes a session from it and the patient's Treatment tab shows live progress.

### 8.3 The Treatment Board

**Treatment → Board** is the live floor view for today:

- Live clock and a colour legend — **red = not started, orange = in progress, green = completed**
- Clickable summary tiles: **Not Started / In Progress / Completed / All** (they filter the board; hovering shows patient names)
- An **idle-patient alert** when someone has been waiting more than 20 minutes
- One card per patient grouping all of their sessions

Card actions: **Start** (assigns therapist + room; blocked if that patient already has a session running), **Complete** (which fires the WhatsApp review request), **Cancel**, and **Add Therapy** for an ad-hoc extra session.

### 8.4 The therapist app

Therapists open `/therapist-login`, tap their name card and enter their PIN on the number pad (auto-submits at 4 digits). Inside:

- A coloured header with the live clock and their room
- **My sessions today** and **Available to claim** lists
- Per session: **Start**, **Upload setup photo** (camera), **Complete**, and **Summary** (allergies, chronic conditions, medication, recent visits)
- Idle-patient banners and Today / This-week stat tiles you can tap for the underlying session list

### 8.5 Scorecards

**Treatment → Scorecards** shows each therapist's 30-day and lifetime star rating with review counts, collected from the WhatsApp review link sent when a session completes. Click a therapist to read individual reviews (service, patient, stars, time).

---

## 9. Daily Ops

Route: `Daily Ops` — a segmented control switching between **Call task** and **To do list**.

![Daily Ops — call tasks grouped by urgency with type and status filters.](/guide-screenshots/daily-ops.png)

### 9.1 Call tasks

Two dropdowns with live counts drive the list:

- **Type** — All, Appointment Tomorrow, Care Call, Cancel Call, Lead
- **Status** — All, Overdue, Due today, Done today

Every row uses the same layout — a colour-coded icon (red overdue, amber due, grey done), the patient link, phone, a context line and the actions.

| Task type | Why it appears | Actions |
|---|---|---|
| **Appointment Tomorrow** | Tomorrow's appointment not yet confirmed by phone | Note, **Mark Called** (with outcome), **Send WhatsApp reminder** |
| **Care Call** | First visit, or 10+ days since the last completed therapy session | Note, **Mark Called**, **Send WhatsApp**, plus **Refresh 10-day gaps** |
| **Cancel Call** | An appointment cancelled in the last 7 days, patient not yet informed | **Mark Informed**, **Send WhatsApp** cancellation notice |
| **Lead** | A lead whose follow-up call is due or overdue | Note, **Mark Called** with outcome |

### 9.2 To-do list

Filters by **Type** (All / Patient tasks / General tasks) and **Priority** (All / High / Medium / Low), grouped into **High priority**, **Medium & low** and **Completed today**. Each item is a checkbox card with priority badge, description, an optional linked-patient chip, and a due date shown red when overdue and amber when due today.

**Add task** captures title (required), description, an optional linked patient, priority and due date.

---

## 10. Leads & follow-ups

### 10.1 The pipeline board

**Lead Pipeline** is a Kanban with five columns: **Attempt 1**, **Attempt 2**, **Attempt 3**, **Lapsed**, **Closed**. Drag a card between columns to change the lead's status; dropping it into an attempt column also sets the next call due date to tomorrow. Cards show name, phone and an overdue-days badge.

A lead becomes **Current** automatically as soon as an appointment is booked for them.

### 10.2 Automatic WhatsApp follow-up

For a patient whose last completed appointment has no newer booking, FlowCare sends a three-stage nudge automatically (a daily job, one message per patient at most):

| Stage | When | Cumulative day |
|---|---|---|
| 1st reminder | 10 days after the last completed visit | Day 10 |
| 2nd reminder | 5 days after the 1st | Day 15 |
| Final reminder | 3 days after the 2nd | Day 18 |

If there's still no booking three days after the final reminder, the lead is closed automatically. Every attempt is logged and visible in the patient's WhatsApp history and in Lead analytics.

Separately, a patient with **10+ days since their last completed therapy session** is flagged as a **Care Call** task (a phone call, not a message).

---

## 11. Billing

### 11.1 Creating an invoice

Choose patient and doctor, set the invoice date, then build the lines: quick-add buttons (Consultation Fee, Follow-up Consultation, Procedure Fee, Report/Certificate Fee), free-text rows (description, quantity, unit price), or pick from the **services** and **store items** catalogues. Add a discount and GST %, and the subtotal / GST / total update live. The invoice number is generated for you and the invoice starts as **unpaid**.

Booking an appointment with services attached prepares the invoice automatically.

### 11.2 Recording a payment

Enter the amount (defaults to the outstanding balance and can't exceed it), pick the method — **Cash, UPI, Card, Insurance, Other** — add the reference where relevant (UPI transaction ID, card last 4, insurance ref) and the payment date. FlowCare recalculates paid / outstanding and sets the status to **paid**, **partial** or **unpaid**, then opens WhatsApp with a formatted receipt if the patient has a phone number.

### 11.3 Invoice detail & sharing

The invoice page has **Print**, **Share** (generates a PDF, gives a short link, sends by WhatsApp or copies it), **Record Payment** and **Cancel Invoice**, plus the payment history. The shared link opens a public invoice viewer — clinic details, line items, status and a Print button — with no login.

### 11.4 Pending invoices

**Pending Invoices** in the sidebar lists everything unpaid or part-paid, with a date picker and a **Show all open** switch, and a running outstanding total. Click through to take the payment.

---

## 12. Analytics

Route: `Settings → Analytics` (also available across all clinics in the super-admin console).

![Analytics: date range, view selector, KPI cards with sparklines and charts.](/guide-screenshots/analytics.png)

**Date range:** Today, This Week, This Month, Last 3 Months, This Year, or **Custom** with start and end dates.

**View selector** — seven views:

| View | Key numbers |
|---|---|
| **Overview** | Headline KPIs with sparklines, plus overdue calls and overdue to-dos |
| **Revenue** | Total billed, collected, outstanding, invoice count |
| **Patients** | Total, new in range, returning in range |
| **Appointments** | Total, completed, cancelled, no-show |
| **Leads** | Leads / won / conversion by source, the full pipeline table, and the follow-up funnel (stage 1/2/3 sent vs booked, plus closed-after-final-reminder) |
| **Treatments** | Sessions total, completed, cancelled, and package completion % |
| **Therapists** | Completed sessions, unique patients, average minutes, average rating, review count |

**Export CSV** downloads every section — revenue, patients, appointments, sessions, operations, therapists, package completion and follow-up conversion — in one file, whichever view is open.

### The Settings PIN

The Settings area (Analytics included) is protected by a clinic-wide **4–6 digit PIN**. The first time it's used you're asked to create one; after that it's requested each time you enter Settings, and stays unlocked while you move around inside Settings. Change it under **Settings → Change Settings PIN**. A super admin can reset it if it's forgotten.

---

## 13. Settings reference

| Section | What you manage |
|---|---|
| **Clinic Profile** | Name, address, phone, email, website, regional language, logo and signature upload |
| **Opening Hours / Doctor Schedule** | Weekly working hours plus one-off exceptions and leave (which surface as cancel-call tasks) |
| **Staff Members** | The team table, editing name / qualification / specialty / registration number, removing staff, and **Invite Staff** |
| **Patient Import** | Bulk CSV import of existing patients |
| **Invoice Services / Store Items** | The catalogues used when billing |
| **Templates** | Clinical note templates available in the consultation workspace |
| **Message Templates** | The WhatsApp message wording used by the manual send buttons |
| **Analytics** | The analytics suite (§12) |
| **Security** | Change password, change the Settings PIN |
| **Data & account** | Audit log viewer (filter by role, action, date), data export, and the account-deletion request |

---

## 14. Super admin console

Route: `/super-admin` — visible only to super-admin accounts.

- **Clinics tab** — every clinic with users, patients, 7-day visits and appointments, 30-day revenue, last activity, active state, WhatsApp state and onboarding status. Per clinic you can:
  - **Enable / Disable** the clinic (disabling asks for a reason and immediately signs out that clinic's admins)
  - **Toggle WhatsApp** — a kill switch; with it off, no automated WhatsApp is sent for that clinic
  - **Reset Settings PIN** — forces the clinic to set a new one
- **Activity tab** — a live feed of audit events across all clinics, filterable by clinic.
- **Platform Analytics** — the same analytics suite aggregated across every clinic, or scoped to one.

---

## 15. WhatsApp automation reference

| Event | When it fires | Automatic? |
|---|---|---|
| **Booked** | An appointment is created | Yes |
| **Rescheduled** | An appointment is moved | Yes |
| **Cancelled** | An appointment is cancelled | Yes |
| **Reminder** | Ahead of tomorrow's appointment | Yes / from Daily Ops |
| **Review** | A therapist completes a therapy session — sends the review link that feeds Scorecards | Yes |
| **Follow-up** | Lapsed-patient sequence on days 10, 15 and 18 | Yes (daily job) |

Manual sends — cancellation notice, care call, prescription share, invoice share, payment receipt, patient-form link — open WhatsApp with the message pre-filled, so you stay in control of the send.

Every automated attempt is logged with its status, and the clinic-level kill switch in the super-admin console stops all of them at once.

---

## 16. FAQ

**A staff member can't log in.**
Check the invite was accepted (they must set a password from the invite email), and that the clinic is enabled in the super-admin console. A disabled clinic signs everyone out with a "clinic disabled" message.

**Slots I expect to be free are greyed out.**
Slot availability comes from the doctor's schedule, their leave exceptions and existing bookings. Check **Settings → Doctor Schedule** first.

**Two treatment patients need the same time.**
That works — only consultation services block a slot; treatment services can share one.

**A patient's treatment tab shows 0/0.**
That patient has no active plan. Create one from the consultation workspace or from **New Plan** on the Treatment Board.

**We forgot the Settings PIN.**
A super admin can reset it, after which the next person entering Settings sets a new one.

**No WhatsApp messages are going out.**
Check the WhatsApp toggle for your clinic in the super-admin console, and confirm the patient has a phone number on their profile.

**Which app should a therapist install?**
Open `/therapist-login` on their phone and install from there — that produces the separate *FlowCare Therapist* home-screen app.

---

## 17. Glossary

- **Lead status** — Attempt 1/2/3 → Current (booked) → Closed or Lapsed
- **Visit** — one consultation record, created at check-in
- **Therapy session** — one treatment appearance on the Treatment Board
- **Treatment plan** — a package of sessions tracked as *n/m done*
- **Care call** — a courtesy call task after a first visit or a 10-day treatment gap
- **Cancel call** — the task to inform a patient their appointment was cancelled
- **Follow-up sequence** — the automatic day-10 / 15 / 18 WhatsApp nudges for lapsed patients
- **Settings PIN** — the 4–6 digit code protecting Settings and Analytics
