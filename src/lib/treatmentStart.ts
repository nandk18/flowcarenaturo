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

/**
 * Ensures that for every treatment-type service in `services`, either an active plan
 * item exists (returned) or a new 1-session "Individual — <service>" plan + item is created.
 * Does NOT insert any therapy_sessions rows.
 */
export async function ensureIndividualPlanForServices(params: {
  clinicId: string;
  patientId: string;
  services: StartTreatmentService[];
  notes?: string | null;
  startDate?: string; // yyyy-MM-dd
}): Promise<void> {
  const { clinicId, patientId, services, notes, startDate } = params;
  const treatmentServices = services.filter(
    (s) => (s.invoice_services?.service_type ?? "consultation") === "treatment" && s.invoice_services,
  );
  if (treatmentServices.length === 0) return;

  const today = startDate ?? new Date().toISOString().split("T")[0];

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
      .select("id, treatment_plan_id, service_id, total_sessions, sessions_scheduled, sessions_completed")
      .in("treatment_plan_id", planIds)
      .in("service_id", svcIds);
    planItems = (data ?? []) as any[];
  }

  const availableByService = new Map<string, any[]>();
  for (const pi of planItems) {
    const remaining = (pi.total_sessions ?? 0) - (pi.sessions_scheduled ?? 0) - (pi.sessions_completed ?? 0);
    if (remaining > 0) {
      const arr = availableByService.get(pi.service_id) ?? [];
      arr.push(pi);
      availableByService.set(pi.service_id, arr);
    }
  }

  for (const s of treatmentServices) {
    const svc = s.invoice_services!;
    const availList = availableByService.get(s.service_id) ?? [];
    if (availList.length > 0) {
      availList.shift();
      continue;
    }
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
    await supabase
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
        notes: notes?.trim() || null,
      } as any);
  }
}

/**
 * Starts treatment for an appointment: ensures plan/plan-items, creates therapy_sessions
 * for today, bumps sessions_scheduled, and marks the appointment in_progress.
 * Returns counts (does not navigate).
 */
export async function startTreatmentForAppointment(appt: StartTreatmentAppt): Promise<StartTreatmentResult> {
  const treatmentServices = (appt.services ?? []).filter(
    (s) => (s.invoice_services?.service_type ?? "consultation") === "treatment" && s.invoice_services,
  );
  if (treatmentServices.length === 0) {
    return { ok: false, error: "No treatment services on this appointment", createdSessions: 0, usedFromPlan: 0, createdIndividual: 0 };
  }

  const today = new Date().toISOString().split("T")[0];
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
      .select("id, treatment_plan_id, service_id, service_name, total_sessions, sessions_scheduled, sessions_completed, notes")
      .in("treatment_plan_id", planIds)
      .in("service_id", svcIds);
    planItems = (data ?? []) as any[];
  }

  const availableByService = new Map<string, any[]>();
  for (const pi of planItems) {
    const remaining = (pi.total_sessions ?? 0) - (pi.sessions_scheduled ?? 0) - (pi.sessions_completed ?? 0);
    if (remaining > 0) {
      const arr = availableByService.get(pi.service_id) ?? [];
      arr.push(pi);
      availableByService.set(pi.service_id, arr);
    }
  }

  const sessionRows: any[] = [];
  const planItemBumps: string[] = [];
  let usedFromPlan = 0;
  let createdIndividual = 0;

  for (const s of treatmentServices) {
    const svc = s.invoice_services!;
    const availList = availableByService.get(s.service_id) ?? [];
    let planItem = availList.shift();

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
            notes: appt.notes?.trim() || null,
          } as any)
          .select("id, treatment_plan_id, sessions_completed, sessions_scheduled")
          .single();
        if (newItem) {
          planItem = newItem;
          createdIndividual++;
        }
      }
    }

    const noteBase = appt.notes?.trim() || planItem?.notes?.trim() || null;

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

  for (const pid of planItemBumps) {
    const item = planItems.find((x) => x.id === pid);
    const currentScheduled = item?.sessions_scheduled ?? 0;
    await supabase
      .from("treatment_plan_items")
      .update({ sessions_scheduled: currentScheduled + 1 })
      .eq("id", pid);
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
