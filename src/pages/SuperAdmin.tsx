import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function SuperAdmin() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"labs" | "clinics" | "mobile">("labs");
  const [labs, setLabs] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && profile.role !== "super_admin") {
      navigate("/dashboard");
      return;
    }
    if (profile?.role === "super_admin") {
      fetchAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const fetchAll = async () => {
    setLoading(true);
    const [labsRes, clinicsRes, patientsRes, visitsRes, prescriptionsRes] = await Promise.all([
      supabase.from("labs").select("*").order("created_at", { ascending: false }),
      supabase.from("clinics").select("*").order("created_at", { ascending: false }),
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase.from("visits").select("id", { count: "exact", head: true }),
      supabase.from("prescriptions").select("id", { count: "exact", head: true }),
    ]);
    setLabs(labsRes.data || []);
    setClinics(clinicsRes.data || []);
    setStats({
      totalClinics: clinicsRes.data?.length || 0,
      totalPatients: patientsRes.count || 0,
      totalVisits: visitsRes.count || 0,
      totalPrescriptions: prescriptionsRes.count || 0,
      totalLabs: labsRes.data?.length || 0,
      verifiedLabs: labsRes.data?.filter((l: any) => l.verified).length || 0,
    });
    setLoading(false);
  };

  const handleVerifyLab = async (labId: string, currentStatus: boolean) => {
    const { error } = await supabase.from("labs").update({ verified: !currentStatus }).eq("id", labId);
    if (error) { toast.error(error.message); return; }
    setLabs(prev => prev.map(l => (l.id === labId ? { ...l, verified: !currentStatus } : l)));
    toast.success(currentStatus ? "Lab unverified" : "Lab verified successfully");
  };

  const handleSuspendLab = async (labId: string, currentStatus: boolean) => {
    const { error } = await supabase.from("labs").update({ suspended: !currentStatus }).eq("id", labId);
    if (error) { toast.error(error.message); return; }
    setLabs(prev => prev.map(l => (l.id === labId ? { ...l, suspended: !currentStatus } : l)));
    toast.success(currentStatus ? "Lab unsuspended" : "Lab suspended");
  };

  if (!profile || profile.role !== "super_admin") return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🩺</span>
          <div>
            <h1 className="font-bold text-white">StethoScribe Super Admin</h1>
            <p className="text-xs text-slate-400">Platform Management Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/super-admin/analytics")}
            className="text-xs bg-teal-600 text-white rounded-lg px-3 py-1.5 hover:bg-teal-700"
          >
            📊 Platform Analytics
          </button>
          <button
            onClick={async () => { await signOut(); navigate("/login"); }}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Clinics", value: stats.totalClinics, icon: "🏥" },
            { label: "Patients", value: stats.totalPatients, icon: "👤" },
            { label: "Consultations", value: stats.totalVisits, icon: "🩺" },
            { label: "Prescriptions", value: stats.totalPrescriptions, icon: "📋" },
            { label: "Labs", value: stats.totalLabs, icon: "🧪" },
            { label: "Verified Labs", value: stats.verifiedLabs, icon: "✅" },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-white">{loading ? "—" : s.value ?? 0}</div>
              <div className="text-xs text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          {(["labs", "clinics", "mobile"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                activeTab === tab
                  ? "bg-teal-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {tab === "mobile" ? "📱 Mobile App" : tab}
            </button>
          ))}
        </div>

        {activeTab === "labs" && (
          <div className="space-y-3">
            {labs.map(lab => (
              <div
                key={lab.id}
                className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-white">{lab.name}</span>
                    {lab.verified && (
                      <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full">
                        ✓ Verified
                      </span>
                    )}
                    {lab.suspended && (
                      <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full">
                        Suspended
                      </span>
                    )}
                    {!lab.verified && !lab.suspended && (
                      <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{lab.email} · {lab.phone}</p>
                  <p className="text-xs text-slate-500">{lab.address}</p>
                  {lab.tests_offered?.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Tests: {lab.tests_offered.join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-slate-600 mt-1">
                    Registered: {new Date(lab.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleVerifyLab(lab.id, lab.verified)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                      lab.verified ? "bg-slate-700 text-slate-300" : "bg-green-600 text-white"
                    }`}
                  >
                    {lab.verified ? "Unverify" : "✓ Verify"}
                  </button>
                  <button
                    onClick={() => handleSuspendLab(lab.id, lab.suspended)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                      lab.suspended ? "bg-teal-600 text-white" : "bg-red-600 text-white"
                    }`}
                  >
                    {lab.suspended ? "Unsuspend" : "Suspend"}
                  </button>
                </div>
              </div>
            ))}
            {!loading && labs.length === 0 && (
              <div className="text-center py-12 text-slate-500">No labs registered yet</div>
            )}
          </div>
        )}

        {activeTab === "clinics" && (
          <div className="space-y-3">
            {clinics.map(clinic => (
              <div
                key={clinic.id}
                className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="flex-1">
                  <p className="font-medium text-white mb-1">{clinic.name}</p>
                  <p className="text-xs text-slate-400">{clinic.address} · {clinic.phone}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Language: {clinic.regional_language} ·
                    Registered: {new Date(clinic.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>Onboarded: {clinic.onboarding_complete ? "✅" : "❌"}</p>
                </div>
              </div>
            ))}
            {!loading && clinics.length === 0 && (
              <div className="text-center py-12 text-slate-500">No clinics registered yet</div>
            )}
          </div>
        )}

        {activeTab === "mobile" && (
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
            <h2 className="text-lg font-bold text-white mb-2">Native Mobile App Build</h2>
            <p className="text-sm text-slate-400 mb-4">
              StethoScribe is configured for native Android and iOS builds using Capacitor.
            </p>
            <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-1 mb-4 border border-slate-800">
              <p className="text-slate-500"># 1. Export project to GitHub and clone locally</p>
              <p>git clone https://github.com/your-repo/stethoscribe</p>
              <p>cd stethoscribe</p>
              <p className="text-slate-500 mt-2"># 2. Install dependencies and build</p>
              <p>npm install</p>
              <p>npm run build</p>
              <p className="text-slate-500 mt-2"># 3. Sync with Capacitor</p>
              <p>npx cap sync</p>
              <p className="text-slate-500 mt-2"># 4. Open in IDE</p>
              <p>npx cap open android   <span className="text-slate-500"># Android Studio</span></p>
              <p>npx cap open ios       <span className="text-slate-500"># Xcode (Mac only)</span></p>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-lg p-3">
              <p className="text-xs text-yellow-300">
                ⚠️ Requires Android Studio (Android) or Xcode with a Mac (iOS).
                iOS builds require an Apple Developer account ($99/year).
                Android builds require a Google Play Console account ($25 one-time).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
