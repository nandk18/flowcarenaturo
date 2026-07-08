import { supabase } from "@/integrations/supabase/client";

export type StartTreatmentService = {
  service_id: string;
  invoice_services: { id: string; name: string; service_type: string | null; amount: number | null } | null;
};

export type StartTreatmentAppt = {
  id: string;
  clinic_id: string;
  patient_id: string;
  notes: string | null;
  services: StartTreatmentService[];
};

export type StartTreatmentResult = {
  ok: boolean;
  error?: string;
  createdSessions: number;
  usedFromPlan: number;
  createdIndividual: number;
};

/** Marker embedded in `treatment_plan_items.notes` so we can find items created
 * for a specific appointment and never duplicate them. */
const marker = (apptId: string) => `[appt:${apptId}]`;
const hasMarker = (notes: string | null | undefined, apptId: string) =>
  !!notes && notes.includes(marker(apptId));
const withMarker = (notes: string | null | undefined, apptId: string) => {
  const base = notes?.trim() ?? "";
  return hasMarker(base, apptId) ? base : [base || null, marker(apptId)].filter(Boolean).join(" ");
};
const remainingSessions = (pi: any) =>
  (pi.total_sessions ?? 0) - (pi.sessions_scheduled ?? 0) - (pi.sessions_completed ?? 0);

/**
 * For each treatment-type service on an appointment, ensures exactly one active
 * plan item exists (idempotent per appointment). Does NOT insert therapy_sessions.
 */
export async function ensureIndividualPlanForServices(params: {
  clinicId: string;
  patientId: string;
  services: StartTreatmentService[];
  notes?: string | null;
  startDate?: string; // yyyy-MM-dd
  appointmentId?: string | null;
}): Promise<void> {
  const { clinicId, patientId, services, notes, startDate, appointmentId } = params;
  const treatmentServices = services.filter(
    (s) => (s.invoice_services?.service_type ?? "consultation") === "treatment" && s.invoice_services,
  );
  if (treatmentServices.length === 0) return;

  const today = startDate ?? new Date().toISOString().split("T")[0];

  // Load all active plan items for this patient (across all active plans) — we'll
  // match by service_id and (when possible) by appointment marker.
  const { data: activePlans } = await supabase
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .eq("status", "active");
  const planIds = (activePlans ?? []).map((p: any) => p.id);
  let planItems: any[] = [];
  if (planIds.length > 0) {
    const svcIds = treatmentServices.map((s) => s.service_id);
    const { data } = await supabase
      .from("treatment_plan_items")
      .select("id, treatment_plan_id, service_id, total_sessions, sessions_scheduled, sessions_completed, notes, status")
      .in("treatment_plan_id", planIds)
      .in("service_id", svcIds);
    planItems = (data ?? []) as any[];
  }

  for (const s of treatmentServices) {
    const svc = s.invoice_services!;
    // 1) If an item for THIS appointment already exists, skip (idempotent).
    if (appointmentId && planItems.some((pi) => pi.service_id === s.service_id && hasMarker(pi.notes, appointmentId))) {
      continue;
    }
    // 2) If there's any active item for this service with remaining capacity, reuse it (no new plan).
    const reusable = planItems.find(
      (pi) =>
        pi.service_id === s.service_id &&
        (pi.status ?? "active") === "active" &&
        remainingSessions(pi) > 0,
    );
    if (reusable) {
      // Tag the reused plan item so Start Treatment can attach this appointment
      // to the same package item instead of creating an individual duplicate.
      if (appointmentId && !hasMarker(reusable.notes, appointmentId)) {
        const nextNotes = withMarker(reusable.notes, appointmentId);
        await supabase.from("treatment_plan_items").update({ notes: nextNotes }).eq("id", reusable.id);
        reusable.notes = nextNotes;
      }
      continue;
    }

    // 3) Otherwise create a new 1-session individual plan tagged with the appt marker.
    const { data: newPlan, error: planErr } = await supabase
      .from("treatment_plans")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        plan_name: `Individual — ${svc.name}`,
        start_date: today,
        status: "active",
        total_plan_value: svc.amount ?? 0,
      } as any)
      .select("id")
      .single();
    if (planErr || !newPlan) continue;
    const itemNotes = [notes?.trim() || null, appointmentId ? marker(appointmentId) : null]
      .filter(Boolean)
      .join(" ");
    await supabase.from("treatment_plan_items").insert({
      treatment_plan_id: newPlan.id,
      service_id: s.service_id,
      service_name: svc.name,
      total_sessions: 1,
      sessions_scheduled: 0,
      sessions_completed: 0,
      sessions_per_visit: 1,
      amount_per_session: svc.amount ?? 0,
      status: "active",
      notes: itemNotes || null,
    } as any);
  }
}

/**
 * Starts treatment for an appointment: idempotent — if therapy_sessions already
 * exist for this appointment today, it just marks the appointment in_progress
 * and returns. Otherwise it reuses/creates plan items and creates one session
 * per service. Never creates a second "Individual —" plan when one already exists
 * for the (patient, service) pair.
 */
export async function startTreatmentForAppointment(appt: StartTreatmentAppt): Promise<StartTreatmentResult> {
  const treatmentServices = (appt.services ?? []).filter(
    (s) => (s.invoice_services?.service_type ?? "consultation") === "treatment" && s.invoice_services,
  );
  if (treatmentServices.length === 0) {
    return { ok: false, error: "No treatment services on this appointment", createdSessions: 0, usedFromPlan: 0, createdIndividual: 0 };
  }

  const today = new Date().toISOString().split("T")[0];

  // Idempotency: if sessions already exist for this appointment, just mark in_progress.
  const { data: existingSessions } = await supabase
    .from("therapy_sessions")
    .select("id")
    .eq("appointment_id", appt.id)
    .neq("status", "cancelled");
  if ((existingSessions ?? []).length > 0) {
    await supabase.from("appointments").update({ status: "in_progress" }).eq("id", appt.id);
    return {
      ok: true,
      createdSessions: 0,
      usedFromPlan: (existingSessions ?? []).length,
      createdIndividual: 0,
    };
  }

  const svcIds = treatmentServices.map((s) => s.service_id);

  const { data: activePlans } = await supabase
    .from("treatment_plans")
    .select("id")
    .eq("patient_id", appt.patient_id)
    .eq("clinic_id", appt.clinic_id)
    .eq("status", "active");
  const planIds = (activePlans ?? []).map((p: any) => p.id);
  let planItems: any[] = [];
  if (planIds.length > 0) {
    const { data } = await supabase
      .from("treatment_plan_items")
      .select("id, treatment_plan_id, service_id, service_name, total_sessions, sessions_scheduled, sessions_completed, notes, status")
      .in("treatment_plan_id", planIds)
      .in("service_id", svcIds);
    planItems = (data ?? []) as any[];
  }

  const sessionRows: any[] = [];
  const planItemBumps: string[] = [];
  let usedFromPlan = 0;
  let createdIndividual = 0;

  for (const s of treatmentServices) {
    const svc = s.invoice_services!;

    // Prefer item that was tagged for THIS appointment.
    let planItem =
      planItems.find(
        (pi) =>
          pi.service_id === s.service_id &&
          hasMarker(pi.notes, appt.id) &&
          (pi.status ?? "active") === "active" &&
          remainingSessions(pi) > 0,
      ) ?? null;

    // Otherwise reuse any active item with remaining capacity.
    if (!planItem) {
      planItem = planItems.find(
        (pi) =>
          pi.service_id === s.service_id &&
          (pi.status ?? "active") === "active" &&
          remainingSessions(pi) > 0,
      ) ?? null;
    }

    // Tag reused package items to make future retries/double-clicks deterministic.
    if (planItem && !hasMarker(planItem.notes, appt.id)) {
      const nextNotes = withMarker(planItem.notes, appt.id);
      await supabase.from("treatment_plan_items").update({ notes: nextNotes }).eq("id", planItem.id);
      planItem.notes = nextNotes;
    }

    // Last resort: create a fresh individual plan for this service. Do not expand
    // exhausted/completed package items; a new extra session should be individual.
    if (!planItem) {
      const { data: newPlan, error: planErr } = await supabase
        .from("treatment_plans")
        .insert({
          clinic_id: appt.clinic_id,
          patient_id: appt.patient_id,
          plan_name: `Individual — ${svc.name}`,
          start_date: today,
          status: "active",
          total_plan_value: svc.amount ?? 0,
        } as any)
        .select("id")
        .single();
      if (!planErr && newPlan) {
        const itemNotes = [appt.notes?.trim() || null, marker(appt.id)].filter(Boolean).join(" ");
        const { data: newItem } = await supabase
          .from("treatment_plan_items")
          .insert({
            treatment_plan_id: newPlan.id,
            service_id: s.service_id,
            service_name: svc.name,
            total_sessions: 1,
            sessions_scheduled: 0,
            sessions_completed: 0,
            sessions_per_visit: 1,
            amount_per_session: svc.amount ?? 0,
            status: "active",
            notes: itemNotes || null,
          } as any)
          .select("id, treatment_plan_id, sessions_completed, sessions_scheduled, total_sessions")
          .single();
        if (newItem) {
          planItem = { ...newItem, service_id: s.service_id };
          createdIndividual++;
        }
      }
    }

    // Only use the appointment's human-entered notes. Never fall back to
    // planItem.notes — it contains internal `[appt:xxx]` markers we use for
    // idempotency and must never leak into therapy_sessions.notes (which is
    // shown as therapist notes on the board).
    const rawApptNotes = appt.notes?.trim() ?? "";
    const noteBase = rawApptNotes && !/^\[appt:[0-9a-f-]+\]$/i.test(rawApptNotes) ? rawApptNotes : null;

    sessionRows.push({
      clinic_id: appt.clinic_id,
      patient_id: appt.patient_id,
      service_id: s.service_id,
      service_name: svc.name,
      session_date: today,
      session_number: planItem ? (planItem.sessions_completed ?? 0) + (planItem.sessions_scheduled ?? 0) + 1 : 1,
      status: "not_started",
      amount: svc.amount ?? 0,
      notes: noteBase,
      appointment_id: appt.id,
      treatment_plan_id: planItem?.treatment_plan_id ?? null,
      treatment_plan_item_id: planItem?.id ?? null,
    });
    if (planItem) {
      planItemBumps.push(planItem.id);
      usedFromPlan++;
    }
  }

  const { error: insErr } = await supabase.from("therapy_sessions").insert(sessionRows);
  if (insErr) {
    return { ok: false, error: insErr.message, createdSessions: 0, usedFromPlan: 0, createdIndividual: 0 };
  }

  // Bump sessions_scheduled for every item we scheduled a session against.
  for (const pid of planItemBumps) {
    // Re-read latest to avoid stale local counter (in case of concurrent updates).
    const { data: latest } = await supabase
      .from("treatment_plan_items")
      .select("sessions_scheduled")
      .eq("id", pid)
      .maybeSingle();
    const currentScheduled = (latest as any)?.sessions_scheduled ?? 0;
    await supabase.from("treatment_plan_items").update({ sessions_scheduled: currentScheduled + 1 }).eq("id", pid);
  }

  await supabase.from("appointments").update({ status: "in_progress" }).eq("id", appt.id);

  return {
    ok: true,
    createdSessions: sessionRows.length,
    usedFromPlan,
    createdIndividual,
  };
}

/** True when every linked service on the appointment is a treatment. */
export function isTreatmentOnlyAppointment(services: StartTreatmentService[] | null | undefined): boolean {
  const list = services ?? [];
  if (list.length === 0) return false;
  return list.every((s) => (s.invoice_services?.service_type ?? "consultation") === "treatment");
}
