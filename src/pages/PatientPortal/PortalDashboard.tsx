import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePatientPortal } from "@/hooks/usePatientPortal";
import { ChevronRight } from "lucide-react";

export default function PortalDashboard() {
  const navigate = useNavigate();
  const { session } = usePatientPortal();
  const [stats, setStats] = useState({ prescriptions: 0, labs: 0, appointments: 0 });
  const [recentVisit, setRecentVisit] = useState<any>(null);
  const [clinics, setClinics] = useState<any[]>([]);

  useEffect(() => {
    if (!session) return;
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchStats = async () => {
    const ids = session!.patientIds;
    const visitsForCount = await supabase.from("visits").select("id").in("patient_id", ids);
    const visitIds = visitsForCount.data?.map((v) => v.id) || [];

    const [prescriptionsRes, labsRes, appointmentsRes, visitsRes, clinicsRes] =
      await Promise.all([
        visitIds.length
          ? supabase
              .from("prescriptions")
              .select("id", { count: "exact", head: true })
              .in("visit_id", visitIds)
          : Promise.resolve({ count: 0 } as any),
        supabase
          .from("lab_results")
          .select("id", { count: "exact", head: true })
          .in("patient_id", ids),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .in("patient_id", ids)
          .gte("appointment_date", new Date().toISOString().split("T")[0])
          .eq("status", "scheduled"),
        supabase
          .from("visits")
          .select(
            "id, visit_date, chief_complaint, status, clinic_id, doctors(name), clinics(name)",
          )
          .in("patient_id", ids)
          .order("visit_date", { ascending: false })
          .limit(1),
        supabase
          .from("patients")
          .select("clinic_id, clinics(id, name, address)")
          .in("id", ids),
      ]);

    setStats({
      prescriptions: prescriptionsRes.count || 0,
      labs: labsRes.count || 0,
      appointments: appointmentsRes.count || 0,
    });
    if (visitsRes.data?.[0]) setRecentVisit(visitsRes.data[0]);
    const uniqueClinics =
      clinicsRes.data
        ?.map((p: any) => p.clinics)
        .filter((c: any, i: number, arr: any[]) =>
          c && arr.findIndex((x: any) => x?.id === c.id) === i,
        ) || [];
    setClinics(uniqueClinics);
  };

  if (!session?.primaryPatient) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-500">
        Loading…
      </div>
    );
  }
  const patient = session.primaryPatient;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-teal-100">Welcome back</p>
        <h2 className="text-xl font-bold mt-0.5">{patient.name}</h2>
        <div className="flex flex-wrap gap-2 mt-3">
          {patient.blood_group && (
            <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full">
              🩸 {patient.blood_group}
            </span>
          )}
          {patient.gender && (
            <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full capitalize">
              {patient.gender}
            </span>
          )}
          {patient.dob && (
            <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full">
              {new Date().getFullYear() - new Date(patient.dob).getFullYear()}y
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Prescriptions", value: stats.prescriptions, icon: "📋", to: "/patient-portal/prescriptions" },
          { label: "Lab Reports", value: stats.labs, icon: "🧪", to: "/patient-portal/labs" },
          { label: "Upcoming Appts", value: stats.appointments, icon: "📅", to: "/patient-portal/appointments" },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => navigate(s.to)}
            className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100"
          >
            <div className="text-xl">{s.icon}</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{s.value}</div>
            <div className="text-[10px] text-gray-500">{s.label}</div>
          </button>
        ))}
      </div>

      {(patient.allergies as any[])?.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 mb-2">⚠️ Known Allergies</p>
          <div className="flex flex-wrap gap-1">
            {(patient.allergies as any[]).map((a: any, i: number) => (
              <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {typeof a === "string" ? a : a.name || JSON.stringify(a)}
              </span>
            ))}
          </div>
        </div>
      )}

      {(patient.chronic_conditions as any[])?.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-orange-700 mb-2">🏥 Chronic Conditions</p>
          <div className="flex flex-wrap gap-1">
            {(patient.chronic_conditions as any[]).map((c: any, i: number) => (
              <span key={i} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                {typeof c === "string" ? c : c.name || JSON.stringify(c)}
              </span>
            ))}
          </div>
        </div>
      )}

      {recentVisit && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Last Visit
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{recentVisit.chief_complaint}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {recentVisit.doctors?.name} · {recentVisit.clinics?.name}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {new Date(recentVisit.visit_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </div>
      )}

      {clinics.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
            My Clinics
          </p>
          {clinics.map((clinic: any) =>
            clinic ? (
              <div
                key={clinic.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold">
                  {clinic.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{clinic.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">{clinic.address}</p>
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}