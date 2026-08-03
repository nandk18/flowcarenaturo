import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? "";
const PUBLIC_URL = Deno.env.get("PUBLIC_URL") ?? Deno.env.get("SITE_URL") ?? "https://flowcarenaturo.lovable.app";

const TEMPLATES: Record<string, string> = {
  booked: Deno.env.get("TWILIO_TEMPLATE_BOOKED") ?? "",
  rescheduled: Deno.env.get("TWILIO_TEMPLATE_RESCHEDULED") ?? "",
  cancelled: Deno.env.get("TWILIO_TEMPLATE_CANCELLED") ?? "",
  // Reminder reuses the booked template (identical variables) unless overridden.
  reminder: Deno.env.get("TWILIO_TEMPLATE_REMINDER") || Deno.env.get("TWILIO_TEMPLATE_BOOKED") || "",
  review: Deno.env.get("TWILIO_TEMPLATE_REVIEW") ?? "",
  followup: Deno.env.get("TWILIO_TEMPLATE_FOLLOWUP") ?? "",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Normalize an Indian/international phone number to E.164 (+91XXXXXXXXXX). */
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = "+" + d.slice(1).replace(/\D/g, "");
  else {
    d = d.replace(/\D/g, "");
    if (d.length === 10) d = "+91" + d;
    else if (d.length === 12 && d.startsWith("91")) d = "+" + d;
    else if (d.length === 11 && d.startsWith("0")) d = "+91" + d.slice(1);
    else d = "+" + d;
  }
  return /^\+\d{10,15}$/.test(d) ? d : null;
}

/** "14:30:00" -> "02:30 PM" */
function fmtTime(t: string | null | undefined): string {
  if (!t) return "";
  const [hStr, m] = String(t).split(":");
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return String(t);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${m ?? "00"} ${ampm}`;
}

/** "2026-12-10" -> "10/12/2026" */
function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = String(d).split("-");
  return y && m && day ? `${day}/${m}/${y}` : String(d);
}

/** Build the WhatsApp sender number with the whatsapp: prefix. */
function fromWhatsapNumber(): string {
  const num = TWILIO_WHATSAPP_FROM.startsWith("+") ? TWILIO_WHATSAPP_FROM : "+" + TWILIO_WHATSAPP_FROM;
  return `whatsapp:${num}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  let logId: string | null = null;

  try {
    const payload = (await req.json()) as {
      appointment_id?: string;
      therapy_session_id?: string;
      event?: string;
    };
    const { appointment_id, therapy_session_id, event } = payload;

    if (!event || !(event in TEMPLATES)) {
      return json({ error: "a valid event is required" }, 400);
    }
    if (event === "review" && !therapy_session_id) {
      return json({ error: "therapy_session_id is required for review event" }, 400);
    }
    if (["booked", "rescheduled", "cancelled", "reminder"].includes(event) && !appointment_id) {
      return json({ error: "appointment_id is required for this event" }, 400);
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
      return json({ error: "Twilio is not configured" }, 500);
    }

    const contentSid = TEMPLATES[event];
    if (!contentSid) {
      return json({ skipped: true, reason: `no template configured for "${event}"` });
    }

    let to: string | null = null;
    let variables: Record<string, string> = {};
    let clinicId: string | null = null;
    let patientId: string | null = null;
    let logApptId: string | null = appointment_id ?? null;
    let logSessionId: string | null = therapy_session_id ?? null;

    // ------------------------------------------------------------------
    // REMINDER: same context as a booked appointment
    // ------------------------------------------------------------------
    if (event === "reminder") {
      const { data: appt, error: apptErr } = await sb
        .from("appointments")
        .select("id, clinic_id, patient_id, doctor_id, appointment_date, appointment_time, status")
        .eq("id", appointment_id!)
        .maybeSingle();

      if (apptErr) throw new Error(`appointment lookup failed: ${apptErr.message}`);
      if (!appt) return json({ skipped: true, reason: "appointment not found" });

      const [{ data: patient }, { data: clinic }, { data: doctor }] = await Promise.all([
        appt.patient_id
          ? sb.from("patients").select("id, name, first_name, last_name, phone").eq("id", appt.patient_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        appt.clinic_id ? sb.from("clinics").select("name").eq("id", appt.clinic_id).maybeSingle() : Promise.resolve({ data: null } as any),
        appt.doctor_id ? sb.from("doctors").select("name").eq("id", appt.doctor_id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);

      const patientName =
        (patient?.name || `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim()) || "Patient";
      const clinicName = clinic?.name || "the clinic";
      const doctorName = doctor?.name || "your practitioner";
      to = toE164(patient?.phone);

      if (!to) {
        return json({ skipped: true, reason: "patient has no valid phone number" });
      }

      clinicId = appt.clinic_id;
      patientId = appt.patient_id;
      variables = {
        "1": patientName,
        "2": clinicName,
        "3": fmtDate(appt.appointment_date),
        "4": fmtTime(appt.appointment_time),
        "5": doctorName,
      };
    }

    // ------------------------------------------------------------------
    // REVIEW: therapy session completed -> send review link
    // ------------------------------------------------------------------
    else if (event === "review") {
      const { data: session, error: sessionErr } = await sb
        .from("therapy_sessions")
        .select("id, clinic_id, patient_id, therapist_id, service_id, service_name, session_date")
        .eq("id", therapy_session_id!)
        .maybeSingle();

      if (sessionErr) throw new Error(`therapy session lookup failed: ${sessionErr.message}`);
      if (!session) return json({ skipped: true, reason: "therapy session not found" });

      const [{ data: review }, { data: patient }, { data: clinic }, { data: therapist }] = await Promise.all([
        sb.from("therapy_session_reviews").select("id, token").eq("session_id", session.id).maybeSingle(),
        session.patient_id
          ? sb.from("patients").select("id, name, first_name, last_name, phone").eq("id", session.patient_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        session.clinic_id ? sb.from("clinics").select("name").eq("id", session.clinic_id).maybeSingle() : Promise.resolve({ data: null } as any),
        session.therapist_id
          ? sb.from("profiles").select("full_name").eq("id", session.therapist_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);

      if (!review?.token) {
        return json({ skipped: true, reason: "review link not ready" });
      }

      const patientName =
        (patient?.name || `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim()) || "Patient";
      const clinicName = clinic?.name || "our clinic";
      const therapistName = therapist?.full_name || "your therapist";
      to = toE164(patient?.phone);

      if (!to) {
        return json({ skipped: true, reason: "patient has no valid phone number" });
      }

      clinicId = session.clinic_id;
      patientId = session.patient_id;
      logApptId = session.appointment_id ?? null;
      variables = {
        "1": patientName,
        "2": clinicName,
        "3": session.service_name || "your therapy",
        "4": therapistName,
        "5": `${PUBLIC_URL}/review/${review.token}`,
      };
    }

    // ------------------------------------------------------------------
    // BOOKED / RESCHEDULED / CANCELLED: existing appointment flow
    // ------------------------------------------------------------------
    else {
      const { data: appt, error: apptErr } = await sb
        .from("appointments")
        .select("id, clinic_id, patient_id, doctor_id, appointment_date, appointment_time, status")
        .eq("id", appointment_id!)
        .maybeSingle();

      if (apptErr) throw new Error(`appointment lookup failed: ${apptErr.message}`);
      if (!appt) return json({ skipped: true, reason: "appointment not found" });

      // Skip duplicates: already sent this event for this appointment
      const { data: existing } = await sb
        .from("whatsapp_messages")
        .select("id")
        .eq("appointment_id", appointment_id!)
        .eq("event", event)
        .eq("status", "sent")
        .limit(1);
      if (existing && existing.length) {
        return json({ skipped: true, reason: "already sent" });
      }

      const [{ data: patient }, { data: clinic }, { data: doctor }] = await Promise.all([
        appt.patient_id
          ? sb.from("patients").select("id, name, first_name, last_name, phone").eq("id", appt.patient_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        appt.clinic_id ? sb.from("clinics").select("name").eq("id", appt.clinic_id).maybeSingle() : Promise.resolve({ data: null } as any),
        appt.doctor_id ? sb.from("doctors").select("name").eq("id", appt.doctor_id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);

      const patientName =
        (patient?.name || `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim()) || "Patient";
      const clinicName = clinic?.name || "the clinic";
      const doctorName = doctor?.name || "your practitioner";
      to = toE164(patient?.phone);

      if (!to) {
        return json({ skipped: true, reason: "patient has no valid phone number" });
      }

      clinicId = appt.clinic_id;
      patientId = appt.patient_id;
      variables = {
        "1": patientName,
        "2": clinicName,
        "3": fmtDate(appt.appointment_date),
        "4": fmtTime(appt.appointment_time),
        "5": doctorName,
      };
    }

    // Create pending log row
    const { data: logRow } = await sb
      .from("whatsapp_messages")
      .insert({
        clinic_id: clinicId,
        appointment_id: logApptId,
        therapy_session_id: logSessionId,
        patient_id: patientId,
        event,
        to_phone: to,
        template_sid: contentSid,
        status: "pending",
      })
      .select("id")
      .maybeSingle();
    logId = logRow?.id ?? null;

    const form = new URLSearchParams({
      To: `whatsapp:${to}`,
      From: fromWhatsapNumber(),
      ContentSid: contentSid,
      ContentVariables: JSON.stringify(variables),
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        },
        body: form,
      },
    );

    const bodyText = await res.text();

    if (!res.ok) {
      console.error(`Twilio request failed [${res.status}]: ${bodyText}`);
      if (logId) {
        await sb
          .from("whatsapp_messages")
          .update({ status: "failed", error: `[${res.status}] ${bodyText}`.slice(0, 2000) })
          .eq("id", logId);
      }
      return json(
        { error: "Twilio request failed", status: res.status, details: bodyText },
        res.status,
      );
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      // non-JSON success body — keep raw
    }

    if (logId) {
      await sb
        .from("whatsapp_messages")
        .update({ status: "sent", twilio_sid: parsed?.sid ?? null })
        .eq("id", logId);
    }

    return json({ sent: true, sid: parsed?.sid ?? null, to, event });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-appointment-whatsapp error:", message);
    if (logId) {
      await sb
        .from("whatsapp_messages")
        .update({ status: "failed", error: message.slice(0, 2000) })
        .eq("id", logId);
    }
    return json({ error: message }, 500);
  }
});
