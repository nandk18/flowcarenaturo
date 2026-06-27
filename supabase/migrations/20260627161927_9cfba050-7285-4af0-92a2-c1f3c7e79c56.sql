CREATE OR REPLACE FUNCTION public.seed_default_message_templates(p_clinic_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO message_templates 
    (clinic_id, type, name, message_body)
  VALUES
    (p_clinic_id, 'attempt1_reminder',
     'Attempt 1 Call',
     'Hi {patient_name}, this is {clinic_name}. We noticed you recently enquired with us. We would love to help you on your health journey. Please call us at your convenience or reply to this message.'),
    (p_clinic_id, 'attempt2_reminder',
     'Attempt 2 Call',
     'Hi {patient_name}, we tried reaching you earlier from {clinic_name}. We are here to help with your health needs. Please give us a call or let us know a good time to connect.'),
    (p_clinic_id, 'appointment_reminder',
     'Appointment Reminder',
     'Hi {patient_name}, this is a reminder of your appointment tomorrow at {appointment_time} with {doctor_name} at {clinic_name}. Please reply to confirm or call us to reschedule.'),
    (p_clinic_id, 'patient_form_link',
     'Patient Form Link',
     'Hi {patient_name}, welcome to {clinic_name}! Please take a moment to fill in your patient details using this link: {form_link}. This helps us serve you better. Link valid for 7 days.'),
    (p_clinic_id, 'appointment_confirmation',
     'Appointment Confirmation',
     'Hi {patient_name}, your appointment at {clinic_name} is confirmed for {appointment_date} at {appointment_time} with {doctor_name}. See you soon!'),
    (p_clinic_id, 'invoice_payment',
     'Invoice / Payment',
     'Hi {patient_name}, please find your invoice from {clinic_name}. Invoice No: {invoice_number} | Date: {invoice_date} | Total: {invoice_amount}. View here: {invoice_link}. Thank you!'),
    (p_clinic_id, 'care_call',
     'Care Call',
     'Hi {patient_name}, this is {clinic_name}. We hope you are feeling well after your recent visit. We are checking in to see how you are doing. Please feel free to reach out if you need anything or would like to schedule a follow-up appointment.'),
    (p_clinic_id, 'appointment_cancelled_notice',
     'Appointment Cancellation',
     'Hi {patient_name}, we regret to inform you that your appointment at {clinic_name} on {appointment_date} at {appointment_time} has been cancelled due to {reason}. Please contact us to reschedule at your earliest convenience.')
  ON CONFLICT (clinic_id, type) DO NOTHING;
END;
$function$;

-- Backfill new templates for all existing clinics
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.clinics LOOP
    PERFORM public.seed_default_message_templates(r.id);
  END LOOP;
END $$;