import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Wallet, Users, Calendar, Activity, Star, TrendingUp, Download, Loader2,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";
import {
  fetchRevenue, fetchPatients, fetchAppointments,
  fetchTreatments, fetchTherapists, fetchOverdueCounts,
} from "@/lib/analytics/api";
import { RANGES, Range, dateRange, inr, num, DOW_NAMES, downloadCSV, toCSV } from "@/lib/analytics/format";
import { KpiCard } from "./KpiCard";
import { PhoneCall, ListTodo } from "lucide-react";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#ef4444",
  "#8b5cf6", "#10b981", "#ec4899", "#6366f1",
];

type Props = {
  /** null = platform (super admin); string = specific clinic id */
  clinicId: string | null;
  /** Shown above tabs */
  title?: string;
  subtitle?: string;
};

export default function AnalyticsView({ clinicId, title, subtitle }: Props) {
  const [range, setRange] = useState<Range>("This Month");
  const [tab, setTab] = useState("overview");
  const { start, end } = useMemo(() => dateRange(range), [range]);

  const [rev, setRev] = useState<any>(null);
  const [pat, setPat] = useState<any>(null);
  const [app, setApp] = useState<any>(null);
  const [tre, setTre] = useState<any>(null);
  const [the, setThe] = useState<any>(null);
  const [ovd, setOvd] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [r, p, a, t, h, o] = await Promise.all([
          fetchRevenue(clinicId, start, end),
          fetchPatients(clinicId, start, end),
          fetchAppointments(clinicId, start, end),
          fetchTreatments(clinicId, start, end),
          fetchTherapists(clinicId, start, end),
          fetchOverdueCounts(clinicId).catch(() => ({ overdue_calls: 0, overdue_todos: 0 })),
        ]);
        if (cancelled) return;
        setRev(r); setPat(p); setApp(a); setTre(t); setThe(h); setOvd(o);
      } catch (e: any) {
        if (!cancelled) toast.error(e.message || "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clinicId, start, end]);

  const exportAll = () => {
    if (!rev || !pat || !app || !tre || !the) return;
    const rows: (string | number)[][] = [];
    rows.push(["FlowCare Analytics", `${start} to ${end}`]);
    rows.push([]);
    rows.push(["Revenue"]);
    rows.push(["Billed", inr(rev.totals?.total_billed)]);
    rows.push(["Collected", inr(rev.totals?.total_collected)]);
    rows.push(["Outstanding", inr(rev.totals?.outstanding)]);
    rows.push(["Invoices", num(rev.totals?.invoice_count)]);
    rows.push([]);
    rows.push(["Patients"]);
    rows.push(["Total", pat.totals?.total ?? 0]);
    rows.push(["New in range", pat.new_in_range ?? 0]);
    rows.push(["Returning in range", pat.returning_in_range ?? 0]);
    rows.push([]);
    rows.push(["Appointments"]);
    rows.push(["Total", app.totals?.total]);
    rows.push(["Completed", app.totals?.completed]);
    rows.push(["Cancelled", app.totals?.cancelled]);
    rows.push(["No-show", app.totals?.no_show]);
    rows.push([]);
    rows.push(["Sessions"]);
    rows.push(["Total", tre.totals?.total]);
    rows.push(["Completed", tre.totals?.completed]);
    rows.push(["Cancelled", tre.totals?.cancelled]);
    rows.push([]);
    rows.push([]);
    rows.push(["Operations (current)"]);
    rows.push(["Overdue calls (total)", ovd?.overdue_calls ?? 0]);
    rows.push(["  Overdue care calls", ovd?.overdue_care_calls ?? 0]);
    rows.push(["  Overdue lead calls", ovd?.overdue_lead_calls ?? 0]);
    rows.push(["Overdue to-dos", ovd?.overdue_todos ?? 0]);
    rows.push([]);
    rows.push(["Therapist", "Completed", "Unique patients", "Avg minutes", "Avg rating", "Reviews"]);
    for (const t of (the.therapists || [])) {
      rows.push([t.full_name, t.completed, t.unique_patients, t.avg_minutes ?? "", t.avg_rating ?? "", t.reviews_count]);
    }
    downloadCSV("flowcare-analytics", toCSV(rows));
    toast.success("Report downloaded");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rt = rev?.totals || {};
  const pt = pat?.totals || {};
  const at = app?.totals || {};
  const tt = tre?.totals || {};
  const collRate = rt.total_billed > 0 ? Math.round((rt.total_collected / rt.total_billed) * 100) : 0;
  const showRate = at.total > 0 ? Math.round(((at.completed || 0) / at.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {title && <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map(r => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} className="text-xs" onClick={() => setRange(r)}>
              {r}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportAll} className="text-xs gap-1">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full flex-wrap h-auto justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="treatments">Treatments</TabsTrigger>
          <TabsTrigger value="therapists">Therapists</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Revenue billed" value={inr(rt.total_billed)} sub={`${num(rt.invoice_count)} invoices`} icon={Wallet} tone="primary" />
            <KpiCard label="Collected" value={inr(rt.total_collected)} sub={`${collRate}% of billed`} icon={TrendingUp} tone="success" />
            <KpiCard label="Outstanding" value={inr(rt.outstanding)} sub="Unpaid balance" icon={Wallet} tone="warning" />
            <KpiCard label="Patients" value={num(pt.total)} sub={`+${num(pat?.new_in_range)} new`} icon={Users} tone="accent" />
            <KpiCard label="Appointments" value={num(at.total)} sub={`${showRate}% completed`} icon={Calendar} tone="primary" />
            <KpiCard label="Therapy sessions" value={num(tt.total)} sub={`${num(tt.completed)} done · ${num(tt.cancelled)} cancelled`} icon={Activity} tone="accent" />
            <KpiCard label="Unique patients treated" value={num(tt.unique_patients)} icon={Users} tone="success" />
            <KpiCard label="Reviews received" value={num((the?.therapists || []).reduce((s: number, t: any) => s + (t.reviews_count || 0), 0))} icon={Star} tone="warning" />
            <KpiCard label="Overdue calls" value={num(ovd?.overdue_calls)} sub={`${num(ovd?.overdue_care_calls)} care · ${num(ovd?.overdue_lead_calls)} leads`} icon={PhoneCall} tone={ovd?.overdue_calls ? "danger" : "success"} />
            <KpiCard label="Overdue to-dos" value={num(ovd?.overdue_todos)} sub="Past due date" icon={ListTodo} tone={ovd?.overdue_todos ? "danger" : "success"} />
          </div>

          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Revenue over time</CardTitle></CardHeader><CardContent>
            {(rev?.daily || []).length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={rev.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="d" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => inr(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="billed" stroke={COLORS[0]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="collected" stroke={COLORS[5]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* REVENUE */}
        <TabsContent value="revenue" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Gross" value={inr(rt.gross)} icon={Wallet} />
            <KpiCard label="GST" value={inr(rt.gst)} icon={Wallet} tone="accent" />
            <KpiCard label="Discount" value={inr(rt.discount)} icon={Wallet} tone="warning" />
            <KpiCard label="Avg invoice" value={inr(rt.avg_invoice)} icon={TrendingUp} />
            <KpiCard label="Expenses" value={inr(rev?.expenses?.total_exp)} icon={Wallet} tone="danger" />
            <KpiCard label="Net (collected − exp)" value={inr((rt.total_collected || 0) - (rev?.expenses?.total_exp || 0))} icon={TrendingUp} tone="success" />
            <KpiCard label="Aging 0–7d" value={inr(rev?.aging?.b_0_7)} tone="primary" />
            <KpiCard label="Aging 30d+" value={inr(rev?.aging?.b_31_plus)} tone="danger" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Payments by mode</CardTitle></CardHeader><CardContent>
              {(rev?.by_mode || []).length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={rev.by_mode} dataKey="amt" nameKey="mode" innerRadius={45} outerRadius={80}>
                      {rev.by_mode.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => inr(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Top services (revenue)</CardTitle></CardHeader><CardContent>
              {(rev?.by_service || []).length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={rev.by_service} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="service" type="category" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip formatter={(v: any) => inr(v)} />
                    <Bar dataKey="amt" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* PATIENTS */}
        <TabsContent value="patients" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total patients" value={num(pt.total)} icon={Users} />
            <KpiCard label="Active (current)" value={num(pt.current_cnt)} icon={Users} tone="success" />
            <KpiCard label="Leads" value={num(pt.leads)} icon={Users} tone="warning" />
            <KpiCard label="Dormant" value={num(pt.dormant)} icon={Users} tone="danger" />
            <KpiCard label="New in range" value={num(pat?.new_in_range)} icon={TrendingUp} tone="primary" />
            <KpiCard label="Returning in range" value={num(pat?.returning_in_range)} icon={TrendingUp} tone="accent" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">New patients over time</CardTitle></CardHeader><CardContent>
              {(pat?.daily_new || []).length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={pat.daily_new}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="d" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="c" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Gender split</CardTitle></CardHeader><CardContent>
              {(pat?.gender || []).length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pat.gender} dataKey="c" nameKey="g" innerRadius={45} outerRadius={80}>
                      {pat.gender.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent></Card>
          </div>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Age buckets</CardTitle></CardHeader><CardContent>
            {(() => {
              const a = pat?.age_buckets || {};
              const data = [
                { label: "0–17", v: a.a_0_17 || 0 },
                { label: "18–35", v: a.a_18_35 || 0 },
                { label: "36–55", v: a.a_36_55 || 0 },
                { label: "56+", v: a.a_56_plus || 0 },
                { label: "Unknown", v: a.a_unknown || 0 },
              ];
              return (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="v" fill={COLORS[1]} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent></Card>
        </TabsContent>

        {/* APPOINTMENTS */}
        <TabsContent value="appointments" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total" value={num(at.total)} icon={Calendar} />
            <KpiCard label="Completed" value={num(at.completed)} tone="success" icon={Calendar} />
            <KpiCard label="Cancelled" value={num(at.cancelled)} tone="warning" icon={Calendar} />
            <KpiCard label="No-show" value={num(at.no_show)} tone="danger" icon={Calendar} />
            <KpiCard label="Upcoming" value={num(at.upcoming)} tone="primary" icon={Calendar} />
            <KpiCard label="Rescheduled" value={num(at.rescheduled)} tone="accent" icon={Calendar} />
          </div>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Bookings over time</CardTitle></CardHeader><CardContent>
            {(app?.daily || []).length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={app.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="d" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="c" stroke={COLORS[0]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent></Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">By doctor</CardTitle></CardHeader><CardContent>
              {(app?.by_doctor || []).length === 0 ? <Empty /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground text-xs">
                      <th className="py-2">Doctor</th><th className="text-right">Total</th><th className="text-right">Done</th><th className="text-right">Cancelled</th>
                    </tr></thead>
                    <tbody>
                      {app.by_doctor.map((d: any) => (
                        <tr key={d.doctor} className="border-b last:border-0">
                          <td className="py-2">{d.doctor}</td>
                          <td className="text-right">{d.total}</td>
                          <td className="text-right text-emerald-600">{d.completed}</td>
                          <td className="text-right text-red-600">{d.cancelled}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Peak hours</CardTitle></CardHeader><CardContent>
              {(app?.by_hour || []).length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={app.by_hour}>
                    <XAxis dataKey="h" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}:00`} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip labelFormatter={(v) => `${v}:00`} />
                    <Bar dataKey="c" fill={COLORS[2]} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent></Card>
          </div>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Day of week</CardTitle></CardHeader><CardContent>
            {(app?.by_dow || []).length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={(app.by_dow || []).map((r: any) => ({ ...r, name: DOW_NAMES[r.dow] }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="c" fill={COLORS[3]} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* TREATMENTS */}
        <TabsContent value="treatments" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Sessions" value={num(tt.total)} icon={Activity} />
            <KpiCard label="Completed" value={num(tt.completed)} tone="success" icon={Activity} />
            <KpiCard label="In progress" value={num(tt.in_progress)} tone="primary" icon={Activity} />
            <KpiCard label="Not started" value={num(tt.not_started)} tone="accent" icon={Activity} />
            <KpiCard label="Cancelled" value={num(tt.cancelled)} tone="danger" icon={Activity} />
            <KpiCard label="Unique patients" value={num(tt.unique_patients)} icon={Users} />
            <KpiCard label="Plans (period)" value={num(tre?.plans?.total_plans)} sub={`${num(tre?.plans?.active_plans)} active`} icon={Activity} />
            <KpiCard
              label="Plan adherence"
              value={`${tre?.adherence?.planned > 0 ? Math.round((tre.adherence.done / tre.adherence.planned) * 100) : 0}%`}
              sub={`${num(tre?.adherence?.done)}/${num(tre?.adherence?.planned)}`}
              tone="success"
              icon={TrendingUp}
            />
          </div>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Sessions over time</CardTitle></CardHeader><CardContent>
            {(tre?.daily || []).length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tre.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="d" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip /><Legend />
                  <Bar dataKey="completed" stackId="a" fill={COLORS[5]} />
                  <Bar dataKey="cancelled" stackId="a" fill={COLORS[3]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Top treatments</CardTitle></CardHeader><CardContent>
            {(tre?.by_service || []).length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={tre.by_service} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="service" type="category" tick={{ fontSize: 10 }} width={160} />
                  <Tooltip /><Legend />
                  <Bar dataKey="completed" stackId="a" fill={COLORS[5]} />
                  <Bar dataKey="total" fill={COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* THERAPISTS */}
        <TabsContent value="therapists" className="space-y-4 mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground text-xs">
                <th className="py-3 px-4">Therapist</th>
                <th className="text-right px-2">Completed</th>
                <th className="text-right px-2">Cancelled</th>
                <th className="text-right px-2">Patients</th>
                <th className="text-right px-2">Avg mins</th>
                <th className="text-right px-2">Avg rating</th>
                <th className="text-right px-4">Reviews</th>
              </tr></thead>
              <tbody>
                {(the?.therapists || []).length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No therapists</td></tr>
                )}
                {(the?.therapists || []).map((t: any) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 px-4 flex items-center gap-2">
                      {t.therapist_color && <span className="h-3 w-3 rounded-full" style={{ background: t.therapist_color }} />}
                      <span className="font-medium">{t.full_name}</span>
                    </td>
                    <td className="text-right px-2 text-emerald-600">{t.completed || 0}</td>
                    <td className="text-right px-2 text-red-600">{t.cancelled || 0}</td>
                    <td className="text-right px-2">{t.unique_patients || 0}</td>
                    <td className="text-right px-2">{t.avg_minutes ?? "—"}</td>
                    <td className="text-right px-2">
                      {t.avg_rating != null ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{t.avg_rating}</span> : "—"}
                    </td>
                    <td className="text-right px-4">{t.reviews_count || 0}<span className="text-muted-foreground text-xs"> / {t.reviews_sent || 0} sent</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground py-10 text-center">No data for this period</p>;
}
