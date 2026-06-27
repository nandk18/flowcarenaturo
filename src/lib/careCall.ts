import { supabase } from "@/integrations/supabase/client";

/**
 * Mark an appointment as needing a care call when:
 *  - It is the patient's only-ever appointment, AND
 *  - No other (non-cancelled) appointment is scheduled in the next 2 days.
 *
 * Sets care_call_required=true and care_call_due_date = completedDate + 2 days.
 * Safe to call multiple times — idempotent.
 */
export async function checkAndSetCareCall(
  appointmentId: string,
  patientId: string,
  clinicId: string,
  completedDate: string // YYYY-MM-DD
): Promise<void> {
  try {
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId);

    const twoDaysLater = new Date(completedDate + "T00:00:00");
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);
    const twoDaysLaterStr = twoDaysLater.toISOString().slice(0, 10);

    const { data: followUp } = await supabase
      .from("appointments")
      .select("id")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .neq("id", appointmentId)
      .neq("status", "cancelled")
      .gte("appointment_date", completedDate)
      .lte("appointment_date", twoDaysLaterStr)
      .limit(1);

    const needsCareCall = (count ?? 0) === 1 && !(followUp?.length);
    if (!needsCareCall) return;

    await (supabase as any)
      .from("appointments")
      .update({
        care_call_required: true,
        care_call_due_date: twoDaysLaterStr,
      })
      .eq("id", appointmentId);
  } catch (e) {
    // Non-fatal
    console.warn("checkAndSetCareCall failed", e);
  }
}
