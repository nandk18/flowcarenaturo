# StethoScribe — User Guide

## 1. Overview

### What is StethoScribe?
StethoScribe is an AI-powered clinic management system designed for Indian outpatient clinics. It streamlines patient registration, queue management, voice-based clinical documentation, prescription generation, and analytics — all in one platform.

### Who is it for?
- **Small to mid-size Indian clinics** (single or multi-doctor)
- **Doctors** who want to dictate notes instead of typing
- **Receptionists** who manage patient check-ins and queues
- **Clinic administrators** who need analytics and staff management

### Key Features
- Voice-to-SOAP notes with AI (supports Indian languages + English)
- Bilingual prescription generation (English + regional language)
- Queue management with token numbers
- Patient registration with healthcare ID auto-generation
- Multiple clinical note templates (SOAP, Follow-Up, Referral, etc.)
- Prescription sharing via WhatsApp, Email, or link
- Analytics dashboard with charts and CSV export
- Staff invitation and role-based access control
- EMR export (Plain Text, FHIR JSON, CSV)
- Mobile-responsive design

### Supported Regional Languages
Tamil, Hindi, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, Assamese, Urdu, Konkani, Manipuri, Sindhi

### Live URL
[https://stethoscribe.lovable.app](https://stethoscribe.lovable.app)

---

## 2. Getting Started

### Signing Up as Admin
1. Go to [stethoscribe.lovable.app](https://stethoscribe.lovable.app)
2. Click **Sign Up**
3. Enter your email, password, full name, and select **Admin** as role
4. Verify your email address via the confirmation link
5. Log in with your credentials

### Completing Clinic Onboarding
After first login, you'll see the onboarding wizard:
1. Enter your **Clinic Name** (e.g., "Karur Health Centre")
2. Enter your **Clinic Address**
3. Enter your **Clinic Phone Number**
4. Click **Complete Setup**

### Setting Regional Language
1. Go to **Settings** from the sidebar
2. Under **Clinic Details**, find the **Regional Language** dropdown
3. Select your preferred language (e.g., Tamil)
4. Click **Save Clinic Details**
5. This language will appear on all prescriptions as bilingual headers

---

## 3. User Roles

### Admin
Full access to all features:
- Queue management (both reception and doctor views)
- Patient registration and management
- Consultations, voice recording, SOAP notes, prescriptions
- Staff management (invite, edit, remove)
- Templates management
- Analytics dashboard
- Clinic settings

### Doctor
- View today's queue and start/continue consultations
- Voice recording with AI transcription
- SOAP notes with template selection
- Prescription creation and sharing
- Patient history and documents
- Templates (enable/disable from library)

### Receptionist
- Patient registration (new and existing)
- Check-in patients with chief complaint and vitals
- View today's queue
- Access patient list

### How Roles Are Assigned
- The first user who signs up is the **Admin**
- Admin invites staff via **Settings → Invite Staff**
- Invited staff receives an email with a link to set their password
- Role is assigned at invitation time (Doctor or Receptionist)

### How to Invite Staff
1. Go to **Settings** → **Invite Staff** section
2. Enter the staff member's email address
3. Select their role (Doctor or Receptionist)
4. Click **Send Invitation**
5. The staff member receives an email with an activation link

### How Invited Staff Accepts
1. Open the invitation email
2. Click the activation link
3. You'll be redirected to the **Accept Invite** page
4. Enter your full name and set a password
5. Click **Complete Setup**
6. Log in with your email and new password

---

## 4. Admin Features

### 4.1 Dashboard
The admin dashboard shows today's queue with two view modes:

- **Reception View**: Shows patient registration form + queue list
- **Doctor View**: Shows queue cards with consultation actions

**Filter Tabs:**
- **All** — every patient in today's queue
- **Waiting** — patients checked in but not yet seen
- **In Progress** — currently being consulted
- **Completed** — consultation finished

### 4.2 Staff Management (Settings)

#### Inviting Staff
1. Go to **Settings** → **Invite Staff**
2. Enter email and select role
3. Click **Send Invitation**

#### Editing Staff Profiles
1. Go to **Settings** → **Team** section
2. Click the **pencil icon** next to any team member
3. Edit their name, and for doctors: qualification, specialty, registration number
4. Click **Save Changes**

#### Removing Staff
1. In the **Team** section, click the **trash icon** next to the member
2. Confirm the removal
3. The member will lose access to the clinic

### 4.3 Clinic Settings
- **Clinic Name**: Displayed on prescriptions and throughout the app
- **Address**: Appears on prescription headers
- **Phone**: Contact number shown on prescriptions
- **Regional Language**: Select from 15 Indian languages — this enables bilingual prescription headers with the clinic name and doctor name transliterated into the chosen script

### 4.4 Analytics
Navigate to **Analytics** from the sidebar (admin only).

**Date Range Filter**: Choose from Today, This Week, This Month, Last 3 Months, or This Year

**Summary Cards:**
- **Total Patients** — unique patients in the period, with count of new patients
- **Total Consultations** — total visits, with completed vs. in-progress breakdown
- **Prescriptions Generated** — number of prescriptions created
- **Avg Patients/Day** — average daily patient count with peak day

**Charts:**
- **Consultations Over Time** — line chart showing daily patient volume
- **Top Diagnoses** — horizontal bar chart of most common assessments from SOAP notes
- **Top Medications** — horizontal bar chart of most prescribed drugs
- **Doctor Performance** — table showing consultations, completed, and prescriptions per doctor
- **Patient Demographics** — pie charts for gender split and blood group distribution

**Export**: Click **Export CSV Report** to download all analytics data as a spreadsheet

### 4.5 Templates Management
Navigate to **Templates** from the sidebar.

**Library Tab**: Shows all available system templates with toggle switches to enable/disable:
- SOAP Notes
- SOAP Detailed
- Clinical Notes
- General Health Check-Up
- General Inpatient Admission
- Follow-Up Visit
- Referral Letter
- Prescription Only
- Oncology Consultation
- EKA EMR Format

**My Templates Tab**: Shows only the templates you've enabled

Enabled templates appear in the consultation workspace's template dropdown.

---

## 5. Receptionist Features

### 5.1 Patient Registration

#### Searching Existing Patients
- Use the search bar to find patients by **name**, **phone number**, or **healthcare ID**
- Matching patients appear below — click to select

#### Registering New Patients
Fill in the registration form:
- **First Name** and **Last Name** (required)
- **Date of Birth**
- **Gender** (Male/Female/Other)
- **Phone Number**
- **Email**
- **Blood Group**
- **Allergies** (add multiple)
- **Chronic Conditions** (add multiple)

**Healthcare ID** is auto-generated in the format: `MED-YYYY-XXXXX` (e.g., MED-2026-00042)

### 5.2 Patient Check-In

After selecting or registering a patient:
1. Enter the **Chief Complaint** (reason for visit)
2. Optionally enter vitals:
   - Blood Pressure (systolic/diastolic)
   - Pulse (bpm)
   - Temperature (°F)
   - SpO2 (%)
   - Weight (kg)
   - Height (cm)
3. Click **Check In Patient**
4. A **token number** is auto-assigned (sequential for the day)

Vitals can be updated later for waiting patients.

---

## 6. Doctor Features

### 6.1 Queue View
- See today's queue sorted by token number
- Each card shows: token #, patient name, chief complaint, check-in time
- **Vitals indicator**: Green dot = vitals recorded, Red dot = no vitals
- **Start Consultation**: Changes status from "waiting" to "in progress"
- **Continue**: Resume an in-progress consultation
- **View Notes**: Read-only view of completed consultations

### 6.2 Consultation Workspace — 6 Tabs

#### Tab 1: Summary
- Patient name, age, gender
- Healthcare ID
- Blood group
- Allergies (shown as red badges)
- Chronic conditions (shown as orange badges)
- Chief complaint
- Today's vitals (if recorded)

#### Tab 2: History
- Past visits listed in reverse chronological order
- Each card shows: date, doctor name, chief complaint, assessment
- Medications shown as chips
- Expandable to see full SOAP notes
- **View Prescription** button to see past prescriptions

#### Tab 3: Voice Record
- Dark themed interface inspired by Apple Voice Memos
- Tap the **large red button** to start recording
- Live waveform visualization during recording
- Timer counts up showing recording duration
- Tap **stop** to end recording
- Audio is automatically sent to OpenAI Whisper for transcription
- Supports all Indian languages + English with auto-detection
- After transcription, AI formats notes into the selected template using Claude
- Automatically switches to the SOAP tab with populated fields

#### Tab 4: SOAP Notes
- **Template selector dropdown** at the top
- Only enabled templates appear in the dropdown
- Last used template is auto-selected
- Dynamic fields change when template is switched
- If notes already exist and you switch templates: **AI automatically reformats** the content to match the new template structure
- All fields are manually editable

#### Tab 5: Rx (Prescription)
- Add medications with:
  - Drug name
  - Dosage
  - M/A/E/N timing checkboxes (Morning/Afternoon/Evening/Night)
  - Duration
  - Notes (e.g., "after food")
- Add investigations (e.g., "CBC", "Blood Sugar Fasting")
- Set follow-up date
- Add additional notes

#### Tab 6: Docs (Documents)
- Upload scans, reports, and documents (PDF, JPG, PNG — up to 20MB)
- View uploaded files
- Delete files
- Files are linked to the specific visit

### 6.3 Completing a Consultation
- At least one note field must be filled before completing
- Click **Complete Consultation** to:
  1. Save SOAP notes to the database
  2. Save prescription details
  3. Update visit status to "completed"
  4. Generate the prescription HTML file with bilingual headers
  5. Show the sharing modal

### 6.4 Prescription Sharing
After completing a consultation, the sharing modal offers:
- **WhatsApp**: Opens wa.me link with the patient's phone and prescription viewer URL
- **Email**: Opens mailto with prescription link in the body
- **Copy Link**: Copies `stethoscribe.lovable.app/rx/[id]` to clipboard
- **Download**: Downloads the prescription file directly
- **Print**: Opens browser print dialog

### 6.5 Prescription Viewer (Public)
- URL format: `stethoscribe.lovable.app/rx/[prescriptionId]`
- **No login required** — anyone with the link can view
- Renders the full prescription with bilingual headers (English + regional language)
- **Print / Save PDF** button at the top
- Works on any device including mobile phones
- Prescription includes: clinic header, doctor details, patient info, vitals, clinical notes, medications table, investigations, follow-up date

---

## 7. Templates

### Accessing Templates
Click **Templates** in the sidebar (available to Doctors and Admins).

### Library Tab
- Shows all available system templates
- Toggle switches to enable/disable each template
- Enabled templates appear in the consultation workspace dropdown

### My Templates Tab
- Shows only your enabled templates
- Quick reference for what's available during consultations

### Template Behavior in Consultations
- Only enabled templates appear in the SOAP tab dropdown
- The last used template is remembered and auto-selected
- Switching templates with existing notes triggers **AI-powered reformatting** — clinical content is preserved but restructured to match the new template fields

---

## 8. Patient Records

### Patient List
- Accessible to all roles from the sidebar
- Search by name or phone number
- Click any patient to view their full history

### Patient Detail Page
- Shows patient demographics and medical info
- Lists all past visits with SOAP notes and prescriptions
- Admin can **delete patient records** (with confirmation dialog)
- Deleting a patient removes all associated visits, notes, prescriptions, and documents

---

## 9. Prescription Format

Prescriptions are generated as HTML with the following structure:
- **Bilingual header**: Clinic name and doctor name in English + regional script (transliterated using Claude AI)
- **Clinic block**: Name, address, phone
- **Doctor block**: Name, qualification, registration number, specialty
- **Patient bar**: Name, Healthcare ID, Age/Gender, Date
- **Vitals section** (if recorded)
- **Chief complaint**
- **Clinical notes** in the selected template format
- **Medication table** with M/A/E/N (Morning/Afternoon/Evening/Night) timing columns
- **Investigations** list
- **Follow-up date**
- **Doctor signature block**
- Uses Google **Noto fonts** for correct rendering of all Indian scripts

---

## 10. EMR Export

Available from patient history and after consultation completion:
- **Plain Text**: Copy-paste into Practo, eVital, Meddbase, or any EMR system
- **FHIR JSON**: HL7-compatible format for EMR integration
- **CSV**: Spreadsheet format for data analysis

Compatible with: Practo, eVital, Meddbase, NHA ABDM

---

## 11. Security

- **Row Level Security (RLS)** on all database tables — clinic data is fully isolated
- Staff can only see data from their own clinic
- **Forgot password** flow via email link
- **Change password** available in Settings → Security
- Invited staff set their own password via the email activation link
- All storage buckets are private (except clinic assets)
- Prescription viewer uses time-limited signed URLs for file access

---

## 12. Mobile Usage

- Fully responsive design — works on phones, tablets, and desktops
- **Hamburger menu** on mobile replaces the sidebar
- Queue cards are optimized for mobile viewing
- Consultation tabs shown as a **2×3 grid** on mobile screens
- All forms, modals, and dialogs fit mobile screens
- Prescription viewer works on any mobile browser
- Voice recording works on mobile (requires HTTPS)

---

## 13. Test Credentials

*(To be updated with actual clinic credentials after setup)*

| Role | Email | Password |
|------|-------|----------|
| Admin | [email] | [password] |
| Doctor | [email] | [password] |
| Receptionist | [email] | [password] |

**Live URL**: [https://stethoscribe.lovable.app](https://stethoscribe.lovable.app)
