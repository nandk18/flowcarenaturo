import { supabase } from "@/integrations/supabase/client";

// clinicId semantics:
//   string  -> that specific clinic (admin: only own; super_admin: any)
//   null    -> all clinics combined (super_admin only)
//   For "my clinic" the caller should pass their profile.clinic_id.

async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const fetchRevenue = (clinicId: string | null, from: string, to: string) =>
  rpc("analytics_revenue", { p_clinic_id: clinicId, p_from: from, p_to: to });

export const fetchPatients = (clinicId: string | null, from: string, to: string) =>
  rpc("analytics_patients", { p_clinic_id: clinicId, p_from: from, p_to: to });

export const fetchAppointments = (clinicId: string | null, from: string, to: string) =>
  rpc("analytics_appointments", { p_clinic_id: clinicId, p_from: from, p_to: to });

export const fetchTreatments = (clinicId: string | null, from: string, to: string) =>
  rpc("analytics_treatments", { p_clinic_id: clinicId, p_from: from, p_to: to });

export const fetchTherapists = (clinicId: string | null, from: string, to: string) =>
  rpc("analytics_therapists", { p_clinic_id: clinicId, p_from: from, p_to: to });

export const fetchPlatformOverview = (from: string, to: string) =>
  rpc("analytics_platform_overview", { p_from: from, p_to: to });
