import { supabase } from "@/integrations/supabase/client";

// Pagination helper — never fetch all records.
export const paginate = (query: any, page: number, pageSize: number = 20) => {
  return query.range(page * pageSize, (page + 1) * pageSize - 1);
};

// Optimized patient search — uses indexes.
export const searchPatients = async (clinicId: string, term: string, page = 0) => {
  if (!term.trim()) {
    return supabase
      .from("patients")
      .select("id, name, healthcare_id, phone, gender, dob, blood_group")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .range(page * 20, page * 20 + 19);
  }

  return supabase
    .from("patients")
    .select("id, name, healthcare_id, phone, gender, dob, blood_group")
    .eq("clinic_id", clinicId)
    .or(
      `name.ilike.%${term}%,phone.ilike.%${term}%,healthcare_id.ilike.%${term}%`
    )
    .order("name", { ascending: true })
    .range(page * 20, page * 20 + 19);
};

// Optimized queue fetch — only what UI needs.
export const fetchQueue = async (clinicId: string, date: string, status?: string) => {
  let query = supabase
    .from("visits")
    .select(
      `
      id, token_number, status, chief_complaint, vitals, created_at,
      patients!inner(id, name, healthcare_id, gender, dob, blood_group, allergies, chronic_conditions),
      doctors(id, name, qualification)
    `
    )
    .eq("clinic_id", clinicId)
    .eq("visit_date", date)
    .order("token_number", { ascending: true });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  return query;
};

// Lightweight patient history.
export const fetchPatientSummary = async (patientId: string) => {
  return supabase
    .from("visits")
    .select(
      `
      id, visit_date, status, chief_complaint, token_number,
      doctors(name),
      clinical_notes(id, soap_notes),
      prescriptions(id, medications, follow_up_date)
    `
    )
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false })
    .limit(20);
};

// Count-only queries for badges/stats (very fast).
export const countPending = async (clinicId: string) => {
  const today = new Date().toISOString().split("T")[0];
  const [queue, labResults, appointments] = await Promise.all([
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("visit_date", today)
      .in("status", ["waiting", "in_progress"]),
    supabase
      .from("lab_results")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "pending_review"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("appointment_date", today)
      .eq("status", "scheduled"),
  ]);

  return {
    queueCount: queue.count || 0,
    pendingLabResults: labResults.count || 0,
    todayAppointments: appointments.count || 0,
  };
};