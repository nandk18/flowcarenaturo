# Seven fixes: activation wording, data protection, auto form link, Daily Ops, treatment controls

## 1. Activation message wording

The onboarding confirmation still promises a 7-day free trial, which no longer exists. New wording:

"Your clinic setup has been submitted. Our team will review and activate your account shortly. You'll receive an email once approved."

The same stale trial wording appears on the sign-in screen and the subscription screen; both get corrected so nothing mentions a trial.

## 2. Data protection

Two parts, as agreed:

- A short document describing the protection already in place: all patient data is encrypted at rest on the database servers and encrypted in transit between the app and the database; access is restricted per clinic; WhatsApp credentials are already stored scrambled with a private key only the server holds.
- Encrypt the most sensitive free-text fields stored on patient records: medication history, past surgery details, and emergency contact phone. These are written and read only through the app, so scrambling them does not affect searching by name, phone or ID.

Not encrypted (needed for searching, sorting, messaging and invoices): name, phone, email, appointment and billing data.

## 3. Form link should send automatically

Today "Send form link" creates the link and opens WhatsApp with the message pre-typed, so nothing is sent unless someone presses send in WhatsApp — that is why patients did not receive it.

Change: the button sends the message straight through the clinic's WhatsApp sending service, the same way booking and reminder messages already go out, and shows sent/failed feedback. A new approved WhatsApp template for the form link is required; until it is approved the button falls back to today's open-WhatsApp behaviour so nothing breaks.

## 4. Daily Ops call tasks stuck loading

Confirmed cause: the call-task screen recalculates its date values on every redraw, which makes the data load restart endlessly, so the spinner never clears and the page freezes. Fix by computing today's and tomorrow's dates once per load instead of on every redraw, so the data loads a single time and the call task lists, counts and dropdowns settle immediately.

## 5. Hide Treatments in the dashboard when treatment is off

The clinical dashboard always shows the Treatments tab and its counts. It will be hidden when the clinic has treatment turned off, matching how the sidebar and home screen already behave.

## 6. Super admin switch for treatment

Add a per-clinic "Treatment: On / Off" button on the super admin clinic list, next to the existing WhatsApp switch, backed by a new secured action that only super admins can run.

## 7. Treatment booking on occupied slots

Currently treatment bookings can always be placed on a slot a doctor already has. Add a clinic setting (Settings > Clinic) "Allow treatments on booked consultation slots":

- On: today's behaviour — treatments ignore consultation bookings.
- Off: a slot taken by a consultation is blocked for treatments too, with a clear message.

Applies to slot availability, the booking check, and the final safety check just before saving.

## Technical notes

- Wording: `src/pages/Onboarding.tsx`, `src/pages/Auth.tsx`, `src/pages/SubscriptionPage.tsx`.
- Encryption: pgcrypto symmetric encryption via security-definer functions using a server-held key secret; `patients.medication_history`, `past_surgery_details`, `emergency_contact_phone` moved to encrypted columns with a view/RPC accessor; migrate existing values in the same migration. Document written to `/mnt/documents`.
- Form link: new `patient_form_link` event in `supabase/functions/send-appointment-whatsapp` + `_shared/whatsappSender.ts` template map and `TWILIO_TEMPLATE_FORM_LINK` / per-clinic `template_form_link` column; callers in `SalesPatientDetail.tsx` and `PatientDetailPage.tsx` invoke the function instead of `openWhatsApp`.
- Daily Ops: in `src/pages/CallTaskPage.tsx` the `today`/`tomorrow`/`sevenAgoIso` consts are recreated each render and are dependencies of the `loadAll` useCallback, so the effect re-runs forever. Move them into `useMemo`/inside `loadAll`.
- Dashboard gating: `src/pages/AdminDashboard.tsx` with `useTreatmentEnabled()`.
- Super admin: new `super_admin_set_clinic_treatment(p_clinic_id, p_enabled)` RPC, `treatment_enabled` added to `super_admin_clinic_summary`, button in `src/pages/SuperAdmin.tsx`.
- Slot rule: new `clinics.treatment_overbooking_allowed` boolean (default true), toggle in `src/pages/Settings.tsx`, respected in `src/components/appointments/BookAppointmentModal.tsx` (`blockingAppts`, slot conflict check, pre-save recheck).
