import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Users, Activity, Wallet, Star, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import AnalyticsView from "@/components/analytics/AnalyticsView";
import { KpiCard } from "@/components/analytics/KpiCard";
import { fetchPlatformOverview } from "@/lib/analytics/api";
import { RANGES, Range, dateRange, inr, num, downloadCSV, toCSV } from "@/lib/analytics/format";

export default function SuperAdminAnalytics() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { clinicId } = useParams<{ clinicId?: string }>();

  const [range, setRange] = useState<Range>("This Month");
  const [data, setData] = useState<any>(null);
  const [clinicName, setClinicName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { start, end } = useMemo(() => dateRange(range), [range]);

  useEffect(() => {
    if (profile && profile.role !== "super_admin") {
      navigate("/dashboard");
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (clinicId) {
      supabase.from("clinics").select("name").eq("id", clinicId).maybeSingle()
        .then(({ data }) => setClinicName(data?.name || ""));
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPlatformOverview(start, end)
      .then(d => { if (!cancelled) setData(d); })
      .catch((e: any) => toast.error(e.message || "Failed to load"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clinicId, start, end]);

  // Drill-down mode: reuse AnalyticsView
  if (clinicId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center gap-3">
          <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white" onClick={() => navigate("/super-admin/analytics")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Building2 className="h-5 w-5 text-teal-400" />
          <div>
            <h1 className="font-bold text-white">{clinicName || "Clinic"} · Analytics</h1>
            <p className="text-xs text-slate-400">Super admin drill-down</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-6 bg-background text-foreground min-h-screen">
          <AnalyticsView clinicId={clinicId} />
        </div>
      </div>
    );
  }

  const t = data?.totals || {};
  const clinics = data?.clinics || [];
  const monthly = data?.monthly || [];

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ["Clinic", "Patients", "Appointments", "Sessions completed", "Revenue billed", "Revenue collected", "Avg rating", "Last activity"],
    ];
    for (const c of clinics) {
      rows.push([
        c.name, c.patients ?? 0, c.appointments ?? 0, c.sessions_done ?? 0,
        Number(c.revenue_billed || 0), Number(c.revenue_collected || 0),
        c.avg_rating ?? "", c.last_activity ?? "",
      ]);
    }
    downloadCSV("flowcare-platform", toCSV(rows));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white" onClick={() => navigate("/super-admin")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Super Admin
          </Button>
          <div>
            <h1 className="font-bold text-white">Platform Analytics</h1>
            <p className="text-xs text-slate-400">All clinics · {start} to {end}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map(r => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} className="text-xs" onClick={() => setRange(r)}>
              {r}
            </Button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 bg-background text-foreground min-h-screen">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Total clinics" value={num(t.clinics_total)} icon={Building2} />
              <KpiCard label="Active (30d)" value={num(t.clinics_active_30d)} icon={Building2} tone="success" />
              <KpiCard label="Patients (all-time)" value={num(t.patients_total)} icon={Users} tone="accent" />
              <KpiCard label="Sessions (period)" value={num(t.sessions_range)} icon={Activity} />
              <KpiCard label="Appointments (period)" value={num(t.appointments_range)} icon={Activity} tone="primary" />
              <KpiCard label="Revenue billed" value={inr(t.revenue_billed)} icon={Wallet} tone="primary" />
              <KpiCard label="Revenue collected" value={inr(t.revenue_collected)} icon={Wallet} tone="success" />
              <KpiCard
                label="Collection rate"
                value={t.revenue_billed > 0 ? `${Math.round((t.revenue_collected / t.revenue_billed) * 100)}%` : "0%"}
                icon={Wallet}
                tone="accent"
              />
            </div>

            <Tabs defaultValue="leaderboard">
              <TabsList>
                <TabsTrigger value="leaderboard">Clinic Leaderboard</TabsTrigger>
                <TabsTrigger value="growth">Monthly Trend</TabsTrigger>
              </TabsList>

              <TabsContent value="leaderboard" className="mt-4">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">All clinics · click to drill in</CardTitle>
                    <Button size="sm" variant="outline" className="text-xs" onClick={exportCSV}>Export CSV</Button>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-left text-muted-foreground text-xs">
                        <th className="py-3 px-4">Clinic</th>
                        <th className="text-right px-2">Patients</th>
                        <th className="text-right px-2">Appts</th>
                        <th className="text-right px-2">Sessions</th>
                        <th className="text-right px-2">Billed</th>
                        <th className="text-right px-2">Collected</th>
                        <th className="text-right px-4">Rating</th>
                      </tr></thead>
                      <tbody>
                        {clinics.length === 0 && (
                          <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No clinics</td></tr>
                        )}
                        {clinics.map((c: any) => (
                          <tr
                            key={c.id}
                            className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                            onClick={() => navigate(`/super-admin/analytics/${c.id}`)}
                          >
                            <td className="py-2 px-4 font-medium">{c.name}</td>
                            <td className="text-right px-2">{num(c.patients)}</td>
                            <td className="text-right px-2">{num(c.appointments)}</td>
                            <td className="text-right px-2">{num(c.sessions_done)}</td>
                            <td className="text-right px-2">{inr(c.revenue_billed)}</td>
                            <td className="text-right px-2 text-emerald-600">{inr(c.revenue_collected)}</td>
                            <td className="text-right px-4">
                              {c.avg_rating != null
                                ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{c.avg_rating}</span>
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="growth" className="mt-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue by month (all clinics)</CardTitle></CardHeader>
                  <CardContent>
                    {monthly.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-10 text-center">No data</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={monthly}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: any) => inr(v)} /><Legend />
                          <Bar dataKey="billed" fill="hsl(var(--primary))" />
                          <Bar dataKey="collected" fill="hsl(var(--accent))" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
