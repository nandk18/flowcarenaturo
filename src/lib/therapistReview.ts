import { supabase } from "@/integrations/supabase/client";
import { buildMessage } from "@/lib/messageTemplates";
import { openWhatsApp } from "@/lib/whatsapp";

/**
 * Fetch (or wait briefly for) the review row for a completed therapy session,
 * build the WhatsApp message, open the WhatsApp share sheet, and mark sent.
 */
export async function sendReviewLinkForSession(sessionId: string): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  // Review row is created by an AFTER trigger — retry a few times in case
  // the trigger hasn't materialized the row yet.
  let review: any = null;
  for (let i = 0; i < 4 && !review; i++) {
    const { data } = await supabase
      .from("therapy_session_reviews")
      .select("id, token, clinic_id, patient_id, therapist_id")
      .eq("session_id", sessionId)
      .maybeSingle();
    review = data;
    if (!review) await new Promise((r) => setTimeout(r, 250));
  }
  if (!review) return { ok: false, error: "Review link not ready yet — try Resend on the board." };

  const [{ data: session }, { data: patient }, { data: therapist }, { data: clinic }] = await Promise.all([
    supabase.from("therapy_sessions").select("service_name").eq("id", sessionId).maybeSingle(),
    supabase.from("patients").select("first_name, last_name, name, phone").eq("id", review.patient_id).maybeSingle(),
    review.therapist_id
      ? supabase.from("profiles").select("full_name").eq("id", review.therapist_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.from("clinics").select("name").eq("id", review.clinic_id).maybeSingle(),
  ]);

  const patientName =
    (patient as any)?.name ||
    `${(patient as any)?.first_name ?? ""} ${(patient as any)?.last_name ?? ""}`.trim() ||
    "Patient";
  const phone = (patient as any)?.phone as string | null | undefined;
  if (!phone) return { ok: false, error: "Patient has no phone number." };

  const reviewLink = `${window.location.origin}/review/${review.token}`;
  const message = await buildMessage(review.clinic_id, "therapy_review_request", {
    patient_name: patientName,
    clinic_name: (clinic as any)?.name ?? "our clinic",
    service_name: (session as any)?.service_name ?? "your therapy",
    therapist_name: (therapist as any)?.full_name ?? "your therapist",
    review_link: reviewLink,
  });

  openWhatsApp(phone, message);
  await supabase.rpc("mark_review_sent" as any, { p_token: review.token });
  return { ok: true };
}
