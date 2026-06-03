import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("PORTAL_HMAC_SECRET") ?? SERVICE_ROLE;

const TTL_MS = 24 * 60 * 60 * 1000;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64url(new Uint8Array(sig));
}

async function signToken(patientIds: string[]): Promise<string> {
  const body = JSON.stringify({ pids: patientIds, exp: Date.now() + TTL_MS });
  const payload = b64url(enc.encode(body));
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

async function verifyToken(token: string): Promise<string[] | null> {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = await hmac(payload);
  if (expected !== sig) return null;
  try {
    const body = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    if (typeof body.exp !== "number" || body.exp < Date.now()) return null;
    if (!Array.isArray(body.pids) || body.pids.length === 0) return null;
    return body.pids as string[];
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const action: string = payload?.action;
  if (!action) return json({ error: "missing action" }, 400);

  try {
    if (action === "login") {
      const { phone, dob } = payload;
      if (!phone || !dob) return json({ error: "phone and dob required" }, 400);
      const cleanPhone = String(phone).replace(/\D/g, "");
      if (!cleanPhone) return json({ error: "invalid phone" }, 400);

      const { data: patients, error } = await admin
        .from("patients")
        .select(
          `id, name, healthcare_id, phone, dob, gender, blood_group,
           allergies, chronic_conditions, clinic_id, clinics(name)`,
        )
        .or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone},phone.eq.0${cleanPhone}`);
      if (error) return json({ error: "verification failed" }, 500);
      if (!patients?.length)
        return json({ error: "No records found for this phone number." }, 404);

      const inputDob = new Date(dob).toISOString().split("T")[0];
      const dobMatches = patients.filter(
        (p) => p.dob && new Date(p.dob).toISOString().split("T")[0] === inputDob,
      );
      if (!dobMatches.length)
        return json({ error: "Date of birth does not match our records." }, 401);

      const uniqueNames = [...new Set(dobMatches.map((p) => p.name))];
      if (uniqueNames.length > 1) {
        // Return profile choices without issuing token yet
        return json({ multipleProfiles: dobMatches });
      }
      const patientIds = dobMatches.map((p) => p.id);
      const token = await signToken(patientIds);
      return json({
        token,
        primaryPatient: dobMatches[0],
        allPatients: dobMatches,
        patientIds,
      });
    }

    if (action === "select_profile") {
      // Issue a token for one of the matched profiles after verifying phone+dob again
      const { phone, dob, patient_id } = payload;
      if (!phone || !dob || !patient_id) return json({ error: "missing fields" }, 400);
      const cleanPhone = String(phone).replace(/\D/g, "");
      const { data: patients } = await admin
        .from("patients")
        .select(
          `id, name, healthcare_id, phone, dob, gender, blood_group,
           allergies, chronic_conditions, clinic_id, clinics(name)`,
        )
        .or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone},phone.eq.0${cleanPhone}`);
      const inputDob = new Date(dob).toISOString().split("T")[0];
      const dobMatches = (patients ?? []).filter(
        (p) => p.dob && new Date(p.dob).toISOString().split("T")[0] === inputDob,
      );
      const chosen = dobMatches.find((p) => p.id === patient_id);
      if (!chosen) return json({ error: "profile not found" }, 404);
      const filtered = dobMatches.filter((p) => p.name === chosen.name);
      const patientIds = filtered.map((p) => p.id);
      const token = await signToken(patientIds);
      return json({
        token,
        primaryPatient: chosen,
        allPatients: filtered,
        patientIds,
      });
    }

    // All other actions require a token
    const pids = await verifyToken(payload?.token);
    if (!pids) return json({ error: "invalid or expired session" }, 401);

    if (action === "dashboard") {
      const [visitsRes, labsRes, apptsRes, recentVisitRes, patientsRes] = await Promise.all([
        admin.from("visits").select("id").in("patient_id", pids),
        admin.from("lab_results").select("id", { count: "exact", head: true }).in("patient_id", pids),
        admin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .in("patient_id", pids)
          .gte("appointment_date", new Date().toISOString().split("T")[0])
          .eq("status", "scheduled"),
        admin
          .from("visits")
          .select("id, visit_date, chief_complaint, status, clinic_id, doctors(name), clinics(name)")
          .in("patient_id", pids)
          .order("visit_date", { ascending: false })
          .limit(1),
        admin
          .from("patients")
          .select("clinic_id, clinics(id, name, address)")
          .in("id", pids),
      ]);
      const visitIds = (visitsRes.data ?? []).map((v: any) => v.id);
      let presCount = 0;
      if (visitIds.length) {
        const r = await admin
          .from("prescriptions")
          .select("id", { count: "exact", head: true })
          .in("visit_id", visitIds);
        presCount = r.count ?? 0;
      }
      return json({
        stats: {
          prescriptions: presCount,
          labs: labsRes.count ?? 0,
          appointments: apptsRes.count ?? 0,
        },
        recentVisit: recentVisitRes.data?.[0] ?? null,
        clinics: patientsRes.data ?? [],
      });
    }

    if (action === "prescriptions") {
      const { data: visits } = await admin
        .from("visits")
        .select("id, visit_date, chief_complaint, clinics(name), doctors(name)")
        .in("patient_id", pids)
        .order("visit_date", { ascending: false });
      const visitIds = (visits ?? []).map((v: any) => v.id);
      if (!visitIds.length) return json({ prescriptions: [] });
      const { data: prescriptions } = await admin
        .from("prescriptions")
        .select("id, medications, follow_up_date, created_at, visit_id")
        .in("visit_id", visitIds)
        .order("created_at", { ascending: false });
      const merged = (prescriptions ?? []).map((p: any) => ({
        ...p,
        visit: (visits ?? []).find((v: any) => v.id === p.visit_id),
      }));
      return json({ prescriptions: merged });
    }

    if (action === "lab_results") {
      const { data } = await admin
        .from("lab_results")
        .select(
          `id, file_name, file_url, file_type, ai_summary, status, uploaded_at,
           lab_orders(test_name, test_category, urgency,
             labs(name), visits(visit_date, chief_complaint))`,
        )
        .in("patient_id", pids)
        .order("uploaded_at", { ascending: false });

      // Sign storage URLs for any non-http file_url
      const results = await Promise.all(
        (data ?? []).map(async (r: any) => {
          if (r.file_url && !/^https?:\/\//i.test(r.file_url)) {
            const { data: signed } = await admin.storage
              .from("lab-results")
              .createSignedUrl(r.file_url, 3600);
            if (signed?.signedUrl) r.signed_url = signed.signedUrl;
          }
          return r;
        }),
      );
      return json({ results });
    }

    if (action === "appointments") {
      const { data } = await admin
        .from("appointments")
        .select(
          `id, appointment_date, appointment_time, status, reason, patient_id,
           doctors(name, qualification),
           clinics(name, address, phone)`,
        )
        .in("patient_id", pids)
        .order("appointment_date", { ascending: false });
      return json({ appointments: data ?? [] });
    }

    if (action === "cancel_appointment") {
      const id = payload?.appointment_id;
      if (!id) return json({ error: "appointment_id required" }, 400);
      // Verify ownership server-side
      const { data: appt } = await admin
        .from("appointments")
        .select("id, patient_id, status, appointment_date")
        .eq("id", id)
        .maybeSingle();
      if (!appt || !pids.includes(appt.patient_id))
        return json({ error: "not found" }, 404);
      const today = new Date().toISOString().split("T")[0];
      if (appt.status !== "scheduled" || appt.appointment_date < today)
        return json({ error: "cannot cancel" }, 400);
      const { error } = await admin
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) return json({ error: "could not cancel" }, 500);
      return json({ success: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("patient-portal error", e);
    return json({ error: "internal error" }, 500);
  }
});