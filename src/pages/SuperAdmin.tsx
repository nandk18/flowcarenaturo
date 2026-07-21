import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ClinicRow = {
  clinic_id: string;
  clinic_name: string;
  is_active: boolean;
  disabled_at: string | null;
  disabled_reason: string | null;
  created_at: string;
  onboarding_complete: boolean;
  users_count: number;
  patients_count: number;
  visits_7d: number;
  appts_7d: number;
  revenue_30d: number;
  last_activity: string | null;
};

type ActivityRow = {
  id: string;
  created_at: string;
  clinic_id: string;
  clinic_name: string | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  resource_type: string | null;
  resource_name: string | null;
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function SuperAdmin() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"clinics" | "activity">("clinics");
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicFilter, setClinicFilter] = useState<string>("all");
  const [disableTarget, setDisableTarget] = useState<ClinicRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile && profile.role !== "super_admin") {
      navigate("/dashboard");
    }
  }, [profile, navigate]);

  const fetchClinics = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("super_admin_clinic_summary");
    if (error) { toast.error(error.message); return; }
    setClinics((data ?? []) as ClinicRow[]);
  }, []);

  const fetchActivity = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc("super_admin_recent_activity", { p_limit: 150 });
    if (error) { toast.error(error.message); return; }
    setActivity((data ?? []) as ActivityRow[]);
  }, []);

  useEffect(() => {
    if (profile?.role !== "super_admin") return;
    setLoading(true);
    Promise.all([fetchClinics(), fetchActivity()]).finally(() => setLoading(false));
  }, [profile, fetchClinics, fetchActivity]);

  useEffect(() => {
    if (tab !== "activity" || profile?.role !== "super_admin") return;
    const id = window.setInterval(fetchActivity, 30_000);
    return () => window.clearInterval(id);
  }, [tab, profile, fetchActivity]);

  if (!profile || profile.role !== "super_admin") return null;

  const toggleClinic = async (row: ClinicRow, nextActive: boolean, why: string | null) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("super_admin_set_clinic_active", {
      p_clinic_id: row.clinic_id,
      p_active: nextActive,
      p_reason: why,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(nextActive ? "Clinic enabled" : "Clinic disabled");
    setDisableTarget(null);
    setReason("");
    fetchClinics();
  };

  const filteredActivity = clinicFilter === "all"
    ? activity
    : activity.filter(a => a.clinic_id === clinicFilter);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-white">FlowCare Super Admin</h1>
          <p className="text-xs text-slate-400">Platform oversight · all clinics</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/super-admin/analytics")}
            className="text-xs bg-teal-600 text-white rounded-lg px-3 py-1.5 hover:bg-teal-700"
          >
            Platform Analytics
          </button>
          <button
            onClick={async () => { await signOut(); navigate("/login"); }}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-2 mb-4">
          {(["clinics", "activity"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                tab === t ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {t === "clinics" ? "Clinics" : "Live Activity"}
            </button>
          ))}
        </div>

        {tab === "clinics" && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Clinic</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Users</th>
                    <th className="text-right px-4 py-3">Patients</th>
                    <th className="text-right px-4 py-3">Visits 7d</th>
                    <th className="text-right px-4 py-3">Appts 7d</th>
                    <th className="text-right px-4 py-3">Revenue 30d</th>
                    <th className="text-left px-4 py-3">Last active</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={9} className="text-center py-8 text-slate-500">Loading…</td></tr>
                  )}
                  {!loading && clinics.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-slate-500">No clinics.</td></tr>
                  )}
                  {clinics.map(c => (
                    <tr key={c.clinic_id} className="border-t border-slate-800 hover:bg-slate-950/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{c.clinic_name}</div>
                        <div className="text-xs text-slate-500">
                          Onboarded: {c.onboarding_complete ? "yes" : "no"} ·
                          Created {new Date(c.created_at).toLocaleDateString("en-IN")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full" title={c.disabled_reason ?? ""}>
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.users_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.patients_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.visits_7d}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.appts_7d}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{inr(Number(c.revenue_30d))}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {c.last_activity ? formatDistanceToNow(new Date(c.last_activity), { addSuffix: true }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/super-admin/analytics/${c.clinic_id}`)}
                          className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 mr-1.5"
                        >
                          Analytics
                        </button>
                        {c.is_active ? (
                          <button
                            onClick={() => { setDisableTarget(c); setReason(""); }}
                            className="text-xs px-2.5 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() => toggleClinic(c, true, null)}
                            className="text-xs px-2.5 py-1 rounded-md bg-teal-600 text-white hover:bg-teal-700"
                          >
                            Enable
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "activity" && (
          <div className="bg-slate-900 rounded-xl border border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3 flex-wrap">
              <label className="text-xs text-slate-400">Clinic</label>
              <select
                value={clinicFilter}
                onChange={e => setClinicFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md text-xs px-2 py-1 text-slate-200"
              >
                <option value="all">All clinics</option>
                {clinics.map(c => (
                  <option key={c.clinic_id} value={c.clinic_id}>{c.clinic_name}</option>
                ))}
              </select>
              <button
                onClick={fetchActivity}
                className="ml-auto text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Refresh
              </button>
              <span className="text-[10px] text-slate-500">Auto-refresh every 30s</span>
            </div>
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2">When</th>
                    <th className="text-left px-4 py-2">Clinic</th>
                    <th className="text-left px-4 py-2">User</th>
                    <th className="text-left px-4 py-2">Action</th>
                    <th className="text-left px-4 py-2">Resource</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading…</td></tr>
                  )}
                  {!loading && filteredActivity.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">No activity yet.</td></tr>
                  )}
                  {filteredActivity.map(a => (
                    <tr key={a.id} className="border-t border-slate-800">
                      <td className="px-4 py-2 text-xs text-slate-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-2 text-slate-200">{a.clinic_name ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-300">
                        {a.user_name ?? "—"}
                        {a.user_role && <span className="text-[10px] text-slate-500 ml-1">({a.user_role})</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs bg-slate-800 text-slate-200 px-2 py-0.5 rounded">{a.action}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-400 text-xs">
                        {a.resource_type ?? "—"}{a.resource_name ? ` · ${a.resource_name}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!disableTarget} onOpenChange={(o) => !o && setDisableTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable clinic access</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{disableTarget?.clinic_name}</span> users will be
            signed out and blocked from logging in until re-enabled.
          </p>
          <Textarea
            placeholder="Reason (optional, shown internally)"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisableTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => disableTarget && toggleClinic(disableTarget, false, reason || null)}
            >
              {busy ? "Disabling…" : "Disable clinic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
