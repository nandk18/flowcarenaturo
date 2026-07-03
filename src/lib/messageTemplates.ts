import { supabase } from "@/integrations/supabase/client";

export type MessageTemplateType =
  | "attempt1_reminder"
  | "attempt2_reminder"
  | "appointment_reminder"
  | "patient_form_link"
  | "appointment_confirmation"
  | "invoice_payment"
  | "care_call"
  | "appointment_cancelled_notice"
  | "therapy_session_reminder";

export type MessageTemplate = {
  id: string;
  clinic_id: string;
  type: MessageTemplateType;
  name: string;
  message_body: string;
  is_active: boolean | null;
};

export const TEMPLATE_META: Record<
  MessageTemplateType,
  { label: string; description: string; variables: string[] }
> = {
  attempt1_reminder: {
    label: "Attempt 1 Call",
    description: "Sent when no answer on first call attempt",
    variables: ["{patient_name}", "{clinic_name}"],
  },
  attempt2_reminder: {
    label: "Attempt 2 Call",
    description: "Sent when no answer on second call attempt",
    variables: ["{patient_name}", "{clinic_name}"],
  },
  appointment_reminder: {
    label: "Appointment Reminder",
    description: "Reminder sent the day before the appointment",
    variables: ["{patient_name}", "{clinic_name}", "{appointment_time}", "{doctor_name}"],
  },
  patient_form_link: {
    label: "Patient Form Link",
    description: "Sent when generating a patient intake form link",
    variables: ["{patient_name}", "{clinic_name}", "{form_link}"],
  },
  appointment_confirmation: {
    label: "Appointment Confirmation",
    description: "Sent after a new appointment is booked",
    variables: ["{patient_name}", "{clinic_name}", "{appointment_date}", "{appointment_time}", "{doctor_name}"],
  },
  invoice_payment: {
    label: "Invoice / Payment",
    description: "Sent to share an invoice or payment receipt",
    variables: [
      "{patient_name}",
      "{clinic_name}",
      "{invoice_number}",
      "{invoice_date}",
      "{invoice_amount}",
      "{invoice_link}",
    ],
  },
  care_call: {
    label: "Care Call",
    description: "Post-visit wellbeing check-in for first-time patients",
    variables: ["{patient_name}", "{clinic_name}"],
  },
  appointment_cancelled_notice: {
    label: "Appointment Cancellation",
    description: "Sent to inform a patient that their appointment was cancelled",
    variables: [
      "{patient_name}",
      "{clinic_name}",
      "{appointment_date}",
      "{appointment_time}",
      "{reason}",
    ],
  },
  therapy_session_reminder: {
    label: "Therapy Session Reminder",
    description: "Reminder sent the day before a scheduled therapy session",
    variables: ["{patient_name}", "{clinic_name}", "{service_name}"],
  },
};

export const TEMPLATE_TYPES = Object.keys(TEMPLATE_META) as MessageTemplateType[];

const DEFAULT_BODIES: Record<MessageTemplateType, string> = {
  attempt1_reminder:
    "Hi {patient_name}, this is {clinic_name}. We noticed you recently enquired with us. We would love to help you on your health journey. Please call us at your convenience or reply to this message.",
  attempt2_reminder:
    "Hi {patient_name}, we tried reaching you earlier from {clinic_name}. We are here to help with your health needs. Please give us a call or let us know a good time to connect.",
  appointment_reminder:
    "Hi {patient_name}, this is a reminder of your appointment tomorrow at {appointment_time} with {doctor_name} at {clinic_name}. Please reply to confirm or call us to reschedule.",
  patient_form_link:
    "Hi {patient_name}, welcome to {clinic_name}! Please take a moment to fill in your patient details using this link: {form_link}. This helps us serve you better. Link valid for 7 days.",
  appointment_confirmation:
    "Hi {patient_name}, your appointment at {clinic_name} is confirmed for {appointment_date} at {appointment_time} with {doctor_name}. See you soon!",
  invoice_payment:
    "Hi {patient_name}, please find your invoice from {clinic_name}. Invoice No: {invoice_number} | Date: {invoice_date} | Total: {invoice_amount}. View here: {invoice_link}. Thank you!",
  care_call:
    "Hi {patient_name}, this is {clinic_name}. We hope you are feeling well after your recent visit. We are checking in to see how you are doing. Please feel free to reach out if you need anything or would like to schedule a follow-up appointment.",
  appointment_cancelled_notice:
    "Hi {patient_name}, we regret to inform you that your appointment at {clinic_name} on {appointment_date} at {appointment_time} has been cancelled due to {reason}. Please contact us to reschedule at your earliest convenience.",
};

export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body.replace(/\{(\w+)\}/g, (m, key) => {
    const v = vars[key];
    return v === null || v === undefined ? m : String(v);
  });
}

/** Fetch a template by type; falls back to the built-in default body if none exists. */
export async function getMessageTemplate(
  clinicId: string,
  type: MessageTemplateType
): Promise<string> {
  const { data } = await supabase
    .from("message_templates")
    .select("message_body, is_active")
    .eq("clinic_id", clinicId)
    .eq("type", type)
    .maybeSingle();
  if (data && data.is_active !== false && data.message_body) {
    return data.message_body as string;
  }
  return DEFAULT_BODIES[type];
}

/** Fetch + render in one call. */
export async function buildMessage(
  clinicId: string,
  type: MessageTemplateType,
  vars: Record<string, string | number | null | undefined>
): Promise<string> {
  const body = await getMessageTemplate(clinicId, type);
  return renderTemplate(body, vars);
}

export function defaultBody(type: MessageTemplateType): string {
  return DEFAULT_BODIES[type];
}
