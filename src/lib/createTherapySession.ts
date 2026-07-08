import { supabase } from "@/integrations/supabase/client";

export type CreateTherapySessionParams = {
  clinicId: string;
  patientId: string;
  serviceId: string;
  serviceName: string;
  amount: number;
  date?: string; // yyyy-MM-dd
  therapistNotes?: string | null;
  appointmentId?: string | null;
};

export type CreateTherapySessionResult = {
  session_id: string;
  isExisting: boolean;
  plan_id?: string;
  plan_item_id?: string;
  is_individual: boolean;
  session_number: number;
  total_sessions: number;
};

const APPT_MARKER_RE = /\s*\[appt:[0-9a-f-]+\]\s*/gi;
const sanitizeNotes = (raw?: string | null): string | null => {
  if (!raw) return null;
  const cleaned = raw.replace(APPT_MARKER_RE, "").trim();
  return cleaned.length > 0 ? cleaned : null;
};
const normalizeServiceName = (name?: string | null) =>
  (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Single entry point for creating a therapy_sessions row anywhere in the app.
 * Guarantees:
 *  1. Never inserts appointment-id markers into therapist notes.
 *  2. Deduplicates by (patient, service, date) — no double sessions in a day.
 *  3. Prefers an existing active treatment_plan_item for the service before
 *     falling back to an "Individual - <service>" auto-plan.
 */
export async function createTherapySession(
  params: CreateTherapySessionParams,
): Promise<{ ok: true; data: CreateTherapySessionResult } | { ok: false; error: string }> {
  const {
    clinicId,
    patientId,
    serviceId,
    serviceName,
    amount,
    appointmentId = null,
  } = params;
  const sessionDate = params.date ?? new Date().toISOString().split("T")[0];
  const therapistNotes = sanitizeNotes(params.therapistNotes);

  const targetServiceName = normalizeServiceName(serviceName);

  // 1. Dedup: session already exists for this patient/service/day. Also compare
  // normalized names to handle duplicated services such as two "Colon Therapy" rows.
  const { data: existingRows } = await supabase
    .from("therapy_sessions")
    .select("id, service_id, service_name, session_number, treatment_plan_id, treatment_plan_item_id")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .eq("session_date", sessionDate)
    .neq("status", "cancelled");
  const existing = (existingRows ?? []).find(
    (row: any) => row.service_id === serviceId || normalizeServiceName(row.service_name) === targetServiceName,
  );
  if (existing) {
    return {
      ok: true,
      data: {
        session_id: existing.id,
        isExisting: true,
        plan_id: existing.treatment_plan_id ?? undefined,
        plan_item_id: existing.treatment_plan_item_id ?? undefined,
        is_individual: false,
        session_number: existing.session_number ?? 1,
        total_sessions: 1,
      },
    };
  }

  // 2. Find an active plan item for this patient/service. Match by service_id
  // first, then by normalized service_name for duplicate service catalog rows.
  const { data: planItemsRaw } = await supabase
    .from("treatment_plan_items")
    .select(
      "id, service_id, service_name, sessions_completed, sessions_scheduled, total_sessions, status, treatment_plan_id, treatment_plans!inner(id, patient_id, clinic_id, status)",
    )
    .or("status.eq.active,status.is.null")
    .eq("treatment_plans.patient_id", patientId)
    .eq("treatment_plans.clinic_id", clinicId)
    .eq("treatment_plans.status", "active");

  const activeItem = (planItemsRaw ?? []).find(
    (pi: any) =>
      (pi.service_id === serviceId || normalizeServiceName(pi.service_name) === targetServiceName) &&
      (pi.total_sessions ?? 0) -
        (pi.sessions_scheduled ?? 0) -
        (pi.sessions_completed ?? 0) >
      0,
  );

  let planId: string | null = null;
  let planItemId: string | null = null;
  let sessionNumber = 1;
  let totalSessions = 1;
  let isIndividual = false;

  if (activeItem) {
    planId = (activeItem as any).treatment_plan_id;
    planItemId = (activeItem as any).id;
    isIndividual = normalizeServiceName(((activeItem as any).treatment_plans as any)?.plan_name).startsWith("individual");
    sessionNumber =
      ((activeItem as any).sessions_completed ?? 0) +
      ((activeItem as any).sessions_scheduled ?? 0) +
      1;
    totalSessions = (activeItem as any).total_sessions ?? 1;
    await supabase
      .from("treatment_plan_items")
      .update({ sessions_scheduled: ((activeItem as any).sessions_scheduled ?? 0) + 1 })
      .eq("id", planItemId as string);
  } else {
    // Create an individual plan (no marker in therapist_notes anywhere).
    const { data: newPlan, error: planErr } = await supabase
      .from("treatment_plans")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        plan_name: `Individual - ${serviceName}`,
        start_date: sessionDate,
        status: "active",
        total_plan_value: amount,
      } as any)
      .select("id")
      .single();
    if (planErr || !newPlan) return { ok: false, error: planErr?.message ?? "Failed to create plan" };
    planId = newPlan.id;

    const { data: newItem, error: itemErr } = await supabase
      .from("treatment_plan_items")
      .insert({
        clinic_id: clinicId,
        treatment_plan_id: newPlan.id,
        service_id: serviceId,
        service_name: serviceName,
        total_sessions: 1,
        sessions_per_visit: 1,
        sessions_scheduled: 1,
        sessions_completed: 0,
        amount_per_session: amount,
        status: "active",
      } as any)
      .select("id")
      .single();
    if (itemErr || !newItem) return { ok: false, error: itemErr?.message ?? "Failed to create plan item" };
    planItemId = newItem.id;
    isIndividual = true;
  }

  const { data: newSession, error: sesErr } = await supabase
    .from("therapy_sessions")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      treatment_plan_id: planId,
      treatment_plan_item_id: planItemId,
      service_id: serviceId,
      service_name: serviceName,
      session_date: sessionDate,
      session_number: sessionNumber,
      status: "not_started",
      amount,
      notes: therapistNotes, // sanitized — never contains appt markers
      appointment_id: appointmentId,
    } as any)
    .select("id")
    .single();
  if (sesErr || !newSession) return { ok: false, error: sesErr?.message ?? "Failed to create session" };

  return {
    ok: true,
    data: {
      session_id: newSession.id,
      isExisting: false,
      plan_id: planId ?? undefined,
      plan_item_id: planItemId ?? undefined,
      is_individual: isIndividual,
      session_number: sessionNumber,
      total_sessions: totalSessions,
    },
  };
}
