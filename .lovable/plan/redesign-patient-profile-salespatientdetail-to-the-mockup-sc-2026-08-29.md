# Redesign patient profile (SalesPatientDetail) to the mockup + screenshot

Rework `src/pages/SalesPatientDetail.tsx` so the patient profile follows `flowcare-patient-profile-redesign.html` and the attached screenshot exactly. This page serves both `/patients/:id` and the sales patient view, so it is the single profile surface. All data stays on existing tables; no routes, RPCs or migrations.

## 1. Header
- Back button, patient name + status pill (soft tint, rounded-full, current=green etc. via existing status styles).
- Sub-line under the name: message icon + "Last contacted X days ago via WhatsApp" (derived from the latest `contact_notes` / `whatsapp_messages` row, whichever is newest) and, when unpaid/partial invoices exist, a red-tinted overdue flag chip: "₹X overdue Yd" (Y = days since oldest unpaid invoice date).
- Actions on the right: green WhatsApp button, blue "Add appointment" button, and a three-dot overflow menu (dropdown) containing: Edit patient, Send form link, Print summary (window.print of the profile), Mark as lapsed (status update with confirm). Send form link / Edit keep current logic.

## 2. Glance strip — three cards under the header
- **Next appointment**: next upcoming appointment date/time, or muted "Not yet scheduled"; sub-line "Session N of M due" when an active treatment plan exists.
- **Treatment progress**: "X of Y sessions" with a teal progress bar (data from the same therapy_sessions join already used in `PatientTreatmentTab`; show only when treatment module enabled and a plan exists, otherwise show appointments count card).
- **Last visit**: last past appointment date, sub-line "N total appointments".

## 3. Underline tab strip
Replace the boxed `TabsList` with the mockup's underline tabs (active = bold with blue underline), same five tabs (General, Clinical notes, Invoices, Appointments, Treatment). Tab contents/components unchanged.

## 4. General tab — two-column body grid
- **Left column**
  - "Contact details" card: 2-column label/value grid — Phone, Email, Date of birth (+age), Gender, Lead source, Added on (small caps labels like the mockup).
  - "More details" collapsible card (chevron header + right-side hint "Emergency contact · Lifestyle · Medical history · Documents"): expands to sub-cards for Emergency contact, Lifestyle & habits, Medical history, and Documents (move `PatientDocumentsCard` content in here as a sub-section; upload still works).
  - The lead-status dropdown stays — moved into the Contact details grid as an editable row.
- **Right column**
  - "Contact history" card: merged feed of manual notes and automated WhatsApp messages (`contact_notes` + `whatsapp_messages` where phone/patient matches), each row = text + muted meta line ("Manual note · author · time" / "WhatsApp automated · time"), dividers between rows, show 3 with a "View all history" expand link; the existing Add Note composer moves to the top of this card.
  - "Patient tasks" card: restyle `PatientTodoCard` to the mockup look — checkbox rows, task title, due date sub-line, priority pill (Medium amber / High red) right-aligned, and the "Add task for this patient..." input + blue Add button at the bottom. Same data and mutations.

## 5. Mobile
Header actions collapse (WhatsApp icon-only + overflow menu), glance cards stack to 1 column, kv-grid goes single column, tab strip scrolls horizontally. Keeps the recently fixed mobile alignment intact.

## Technical notes
- Only `src/pages/SalesPatientDetail.tsx` plus a light restyle of `src/components/patient/PatientTodoCard.tsx` (presentation props stay compatible).
- New derived data: latest-contact query (contact_notes + whatsapp_messages), overdue invoice sum/days (already loaded invoices), treatment progress (reuse the therapy_sessions count query from PatientTreatmentTab via a small shared helper or duplicate query in-page).
- Colours via existing semantic tokens only (success/warning/destructive/info tints already in the theme); no literal hex.
- No changes to Clinical notes, Invoices, Appointments, Treatment tab internals; no data-model or route changes.
