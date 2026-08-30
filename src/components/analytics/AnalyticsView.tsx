import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  fetchRevenue, fetchPatients, fetchAppointments,
  fetchTreatments, fetchTherapists, fetchOverdueCounts, fetchFollowups, fetchLeads,
} from "@/lib/analytics/api";
import { RANGES, Range, dateRange, inr, num, DOW_NAMES, downloadCSV, toCSV } from "@/lib/analytics/format";
import { KpiCard } from "./KpiCard";
import { BarChartCard } from "./BarChartCard";
import { DonutChart } from "./DonutChart";
import { FunnelChart } from "./FunnelChart";

const SOURCE_BAR_COLORS = ["bg-teal-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500", "bg-purple-500", "bg-slate-400"];

const LEAD_SOURCES: { key: string; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "phone", label: "Phone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "yuvalife", label: "YuvaLife" },
  { key: "friend", label: "Friend / Referral" },
];


const STAGE_LABEL: Record<number, string> = {
  1: "1st reminder (day 10)",
  2: "2nd reminder (day 15)",
  3: "Final reminder (day 18)",
};


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
  const [customStart, setCustomStart] = useState(() => dateRange("This Month").start);
  const [customEnd, setCustomEnd] = useState(() => dateRange("Today").end);
  const { start, end } = useMemo(
    () => dateRange(range, { start: customStart, end: customEnd }),
    [range, customStart, customEnd],
  );

  const [rev, setRev] = useState<any>(null);
  const [pat, setPat] = useState<any>(null);
  const [app, setApp] = useState<any>(null);
  const [tre, setTre] = useState<any>(null);
  const [the, setThe] = useState<any>(null);
  const [ovd, setOvd] = useState<any>(null);
  const [fol, setFol] = useState<any>(null);
  const [led, setLed] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [r, p, a, t, h, o, f, l] = await Promise.all([
          fetchRevenue(clinicId, start, end),
          fetchPatients(clinicId, start, end),
          fetchAppointments(clinicId, start, end),
          fetchTreatments(clinicId, start, end),
          fetchTherapists(clinicId, start, end),
          fetchOverdueCounts(clinicId).catch(() => ({ overdue_calls: 0, overdue_todos: 0 })),
          fetchFollowups(clinicId, start, end).catch(() => null),
          fetchLeads(clinicId, start, end).catch(() => null),
        ]);
        if (cancelled) return;
        setRev(r); setPat(p); setApp(a); setTre(t); setThe(h); setOvd(o); setFol(f); setLed(l);
      } catch (e: any) {
        if (!cancelled) toast.error(e.message || "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clinicId, start, end]);

  // Always show every known lead source, even with zero leads.
  const sourceRows = useMemo(() => {
    const raw = ((led?.by_source ?? []) as any[]);
    const byKey = new Map(raw.map((r) => [String(r.source).toLowerCase(), r]));
    const rows = LEAD_SOURCES.map((s) => {
      const hit = byKey.get(s.key);
      byKey.delete(s.key);
      return { label: s.label, leads: hit?.leads ?? 0, won: hit?.won ?? 0, rate: hit?.rate ?? 0 };
    });
    for (const [, r] of byKey) {
      rows.push({ label: String(r.source), leads: r.leads ?? 0, won: r.won ?? 0, rate: r.rate ?? 0 });
    }
    return rows;
  }, [led]);

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
    rows.push([]);
    rows.push(["Treatment package completion"]);
    rows.push(["Average completion %", Number(tre?.package?.avg_completion ?? 0)]);
    rows.push(["Plans fully completed", tre?.package?.fully_completed ?? 0]);
    rows.push(["Plans counted", tre?.package?.plans ?? 0]);
    rows.push([]);
    rows.push(["Follow-up conversion", "Sent", "Booked in 7d", "Rate %"]);
    for (const s of (fol?.by_stage || [])) {
      rows.push([STAGE_LABEL[s.stage] ?? `Reminder ${s.stage}`, s.sent, s.booked, Number(s.rate ?? 0)]);
    }
    rows.push(["Overall", fol?.totals?.sent ?? 0, fol?.totals?.booked ?? 0, Number(fol?.totals?.rate ?? 0)]);
    rows.push(["Closed after final reminder", fol?.closed?.closed_patients ?? 0]);
    rows.push([]);
    rows.push(["Leads"]);
    rows.push(["New leads today", led?.totals?.new_today ?? 0]);
    rows.push(["In progress", led?.totals?.in_progress ?? 0]);
    rows.push(["Overdue on next attempt", led?.totals?.overdue_attempts ?? 0]);
    rows.push(["Leads in range", led?.totals?.leads_in_range ?? 0]);
    rows.push(["Converted in range", led?.totals?.converted_in_range ?? 0]);
    rows.push(["Conversion rate %", Number(led?.totals?.conversion_rate ?? 0)]);
    rows.push([]);
    rows.push(["Lead source", "Leads", "Won", "Rate %"]);
    for (const s of (led?.by_source || [])) {
      rows.push([s.source, s.leads, s.won, Number(s.rate ?? 0)]);
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

  const PERIOD_LABEL: Record<Range, string> = {
    "Today": "Today",
    "This Week": "This week",
    "This Month": "This month",
    "Last 3 Months": "Last 3 months",
    "This Year": "This year",
    "Custom": "Custom range",
  };
  const PERIODS: Range[] = ["Today", "This Week", "This Month", "This Year", "Custom"];

  const TAB_LABEL: Record<string, string> = {
    overview: "Overview", revenue: "Revenue", patients: "Patients",
    appointments: "Appointments", leads: "Leads", treatments: "Treatments", therapists: "Therapists",
  };

  // --- Derived series for the top KPI sparklines + charts (no new RPCs; reuses fetched data) ---
  const seriesTrend = (series: number[], mode: "pct" | "pts" | "count" = "pct") => {
    if (!series || series.length < 2) return undefined;
    const first = series[0];
    const last = series[series.length - 1];
    const diff = last - first;
    if (mode === "pts") {
      const pts = Math.round(diff);
      if (pts === 0) return { label: "flat 0pts", direction: "flat" as const };
      const dir: "up" | "down" = pts > 0 ? "up" : "down";
      return { label: `${pts > 0 ? "↑" : "↓"}${Math.abs(pts)}pts`, direction: dir };
    }
    if (mode === "count") {
      const c = Math.round(diff);
      if (c === 0) return { label: "flat", direction: "flat" as const };
      const dirC: "up" | "down" = c > 0 ? "up" : "down";
      return { label: `${c > 0 ? "↑" : "↓"}${Math.abs(c)}`, direction: dirC };
    }
    if (first === 0) {
      if (diff === 0) return { label: "flat", direction: "flat" as const };
      const dirD: "up" | "down" = diff > 0 ? "up" : "down";
      return { label: diff > 0 ? "↑" : "↓", direction: dirD };
    }
    const pct = Math.round((diff / Math.abs(first)) * 100);
    if (pct === 0) return { label: "flat 0%", direction: "flat" as const };
    const dirP: "up" | "down" = pct > 0 ? "up" : "down";
    return { label: `${pct > 0 ? "↑" : "↓"}${Math.abs(pct)}%`, direction: dirP };
  };

  const followSeries = ((fol?.by_stage || []) as any[]).slice().sort((a, b) => a.stage - b.stage).map((s) => Number(s.rate || 0));
  const packageSeries = tre?.package
    ? [tre.package.b0_25, tre.package.b25_50, tre.package.b50_75, tre.package.b75_99, tre.package.b100].map((n) => Number(n || 0))
    : [];
  const revCollectedSeries = ((rev?.daily || []) as any[]).map((d) => Number(d.collected || 0));
  const outstandingSeries = ((rev?.daily || []) as any[]).map((d) => Math.max(Number(d.billed || 0) - Number(d.collected || 0), 0));
  const apptSeries = ((app?.daily || []) as any[]).map((d) => Number(d.c || 0));

  const revenueBarData = ((rev?.daily || []) as any[]).map((d) => ({
    label: DOW_NAMES[new Date(`${d.d}T00:00:00`).getDay()],
    value: Number(d.collected || 0),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        {title && <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>}
        <p className="text-sm text-muted-foreground">{subtitle || "Everything the doctor needs to see, in one glance"}</p>
      </div>

      {/* Toolbar: period segmented control + view dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-1">
          {PERIODS.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                range === r
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABEL[r]}
            </button>
          ))}
        </div>
        {range === "Custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs font-medium">
                View: {TAB_LABEL[tab] ?? "Overview"}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(TAB_LABEL).map(([key, label]) => (
                <DropdownMenuItem key={key} onClick={() => setTab(key)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={exportAll} className="text-xs gap-1">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      {/* ================= OVERVIEW ================= */}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard label="Follow-up conv." value={`${Number(fol?.totals?.rate ?? 0)}%`} tone="primary" trend={seriesTrend(followSeries, "pts")} spark={followSeries} />
            <KpiCard label="Package completion" value={`${Number(tre?.package?.avg_completion ?? 0)}%`} tone="primary" trend={seriesTrend(packageSeries, "pts")} spark={packageSeries} />
            <KpiCard label="Revenue collected" value={inr(rt.total_collected)} tone="success" trend={seriesTrend(revCollectedSeries, "pct")} spark={revCollectedSeries} />
            <KpiCard label="Outstanding" value={inr(rt.outstanding)} tone="warning" trend={seriesTrend(outstandingSeries, "pct")} spark={outstandingSeries} />
            <KpiCard label="Appointments" value={`${num(at.completed)} / ${num(at.total)}`} tone="accent" trend={seriesTrend(apptSeries, "count")} spark={apptSeries} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="shadow-card">
              <CardContent className="pt-5">
                <BarChartCard
                  title="Revenue over time"
                  sub={`${PERIOD_LABEL[range]} · collected`}
                  data={revenueBarData}
                  formatValue={(v) => (v > 0 ? inr(v) : "")}
                />
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="pt-5">
                <DonutChart
                  title="Collected vs outstanding"
                  sub={PERIOD_LABEL[range]}
                  centerLabel={`${collRate}%`}
                  segments={[
                    { label: "Collected", value: Number(rt.total_collected || 0), color: "hsl(var(--success))", formatted: inr(rt.total_collected) },
                    { label: "Outstanding", value: Number(rt.outstanding || 0), color: "hsl(var(--warning))", formatted: inr(rt.outstanding) },
                  ]}
                />
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="pt-5">
                <FunnelChart
                  title="Follow-up funnel"
                  sub={`Reminders → booked, ${PERIOD_LABEL[range].toLowerCase()}`}
                  rows={[
                    { label: "Sent", value: Number(fol?.totals?.sent || 0), color: "hsl(var(--info))" },
                    { label: "Booked", value: Number(fol?.totals?.booked || 0), color: "hsl(var(--success))" },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ================= REVENUE ================= */}
      {tab === "revenue" && (() => {
        const services = ((rev?.by_service || []) as any[]).slice(0, 6);
        return (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="Revenue billed" value={inr(rt.total_billed)} tone="primary" />
              <KpiCard label="Collected" value={inr(rt.total_collected)} tone="success" />
              <KpiCard label="Outstanding" value={inr(rt.outstanding)} tone="warning" />
              <KpiCard label="Avg. bill value" value={inr(rt.avg_invoice)} tone="accent" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="shadow-card">
                <CardContent className="pt-5">
                  <BarChartCard title="Revenue over time" sub={`${PERIOD_LABEL[range]} · collected`} data={revenueBarData} formatValue={(v) => (v > 0 ? inr(v) : "")} />
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="pt-5">
                  <DonutChart
                    title="By treatment type"
                    sub="Share of revenue"
                    centerLabel={services.length ? `${Math.round((Number(services[0].amt || 0) / Math.max(services.reduce((s, x) => s + Number(x.amt || 0), 0), 1)) * 100)}%` : "0%"}
                    segments={services.slice(0, 5).map((s, i) => ({
                      label: String(s.service ?? "—"),
                      value: Number(s.amt || 0),
                      color: DONUT_COLORS[i % DONUT_COLORS.length],
                    }))}
                  />
                </CardContent>
              </Card>
            </div>
            <Card className="shadow-card">
              <CardContent className="pt-5">
                <h3 className="mb-3 text-sm font-semibold">Revenue by treatment type</h3>
                <SimpleTable
                  head={["Treatment", "Invoices", "Billed"]}
                  rows={services.map((s) => [String(s.service ?? "—"), num(s.cnt), inr(s.amt)])}
                />
              </CardContent>
            </Card>
          </>
        );
      })()}

      {/* ================= PATIENTS ================= */}
      {tab === "patients" && (() => {
        const newPts = Number(pat?.new_in_range ?? 0);
        const returning = Number(pat?.returning_in_range ?? 0);
        const seen = newPts + returning;
        const returnRate = seen > 0 ? Math.round((returning / seen) * 100) : 0;
        const avgValue = Number(pt.total || 0) > 0 ? Math.round(Number(rt.total_collected || 0) / Number(pt.total)) : 0;
        const bars = ((pat?.daily_new || []) as any[]).map((d) => ({
          label: DOW_NAMES[new Date(`${d.d}T00:00:00`).getDay()],
          value: Number(d.c || 0),
        }));
        return (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="New patients" value={num(newPts)} tone="accent" />
              <KpiCard label="Active patients" value={num(pt.current_cnt)} tone="success" />
              <KpiCard label="Returning rate" value={`${returnRate}%`} tone="primary" />
              <KpiCard label="Avg. patient value" value={inr(avgValue)} tone="warning" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="shadow-card">
                <CardContent className="pt-5">
                  <BarChartCard title="New patients over time" sub={`${PERIOD_LABEL[range]} · new patients`} data={bars} formatValue={(v) => (v > 0 ? String(v) : "")} />
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="pt-5">
                  <DonutChart
                    title="Patient status"
                    sub="Current book"
                    centerLabel={`${Number(pt.total || 0) > 0 ? Math.round((Number(pt.current_cnt || 0) / Number(pt.total)) * 100) : 0}%`}
                    segments={[
                      { label: "Current", value: Number(pt.current_cnt || 0), color: "hsl(var(--success))" },
                      { label: "Leads", value: Number(pt.leads || 0), color: "hsl(var(--info))" },
                      { label: "Dormant", value: Number(pt.dormant || 0), color: "hsl(var(--warning))" },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        );
      })()}

      {/* ================= APPOINTMENTS ================= */}
      {tab === "appointments" && (() => {
        const bars = ((app?.daily || []) as any[]).map((d) => ({
          label: DOW_NAMES[new Date(`${d.d}T00:00:00`).getDay()],
          value: Number(d.c || 0),
        }));
        return (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="Total appointments" value={num(at.total)} tone="accent" />
              <KpiCard label="Completed" value={`${showRate}%`} tone="success" />
              <KpiCard label="Cancelled" value={num(at.cancelled)} tone="warning" />
              <KpiCard label="No-shows" value={num(at.no_show)} tone="danger" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="shadow-card">
                <CardContent className="pt-5">
                  <BarChartCard title="Appointments over time" sub={`${PERIOD_LABEL[range]} · bookings`} data={bars} formatValue={(v) => (v > 0 ? String(v) : "")} />
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="pt-5">
                  <DonutChart
                    title="Outcome breakdown"
                    sub={PERIOD_LABEL[range]}
                    centerLabel={`${showRate}%`}
                    segments={[
                      { label: "Completed", value: Number(at.completed || 0), color: "hsl(var(--success))" },
                      { label: "Cancelled", value: Number(at.cancelled || 0), color: "hsl(var(--warning))" },
                      { label: "No-show", value: Number(at.no_show || 0), color: "hsl(var(--destructive))" },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        );
      })()}

      {/* ================= LEADS ================= */}
      {tab === "leads" && (() => {
        const pipeline = ((led?.pipeline || []) as any[]);
        const cnt = (s: string) => pipeline.filter((p) => p.status === s).length;
        const a1 = cnt("attempt1"), a2 = cnt("attempt2"), a3 = cnt("attempt3");
        const closed = cnt("closed"), lapsed = cnt("lapsed");
        const attemptsTotal = a1 * 1 + a2 * 2 + a3 * 3;
        const avgAttempts = a1 + a2 + a3 > 0 ? (attemptsTotal / (a1 + a2 + a3)).toFixed(1) : "0";
        const srcRows = sourceRows.filter((s) => s.leads > 0).slice(0, 5);
        const srcTotal = Math.max(srcRows.reduce((s, x) => s + x.leads, 0), 1);
        return (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="New leads" value={num(led?.totals?.leads_in_range)} tone="accent" />
              <KpiCard label="Conversion rate" value={`${Number(led?.totals?.conversion_rate ?? 0)}%`} tone="success" />
              <KpiCard label="Avg. attempts to close" value={avgAttempts} tone="primary" />
              <KpiCard label="Lapsed" value={num(lapsed)} tone="warning" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="shadow-card">
                <CardContent className="pt-5">
                  <FunnelChart
                    title="Pipeline funnel"
                    sub="Attempt 1 → Closed"
                    rows={[
                      { label: "Attempt 1", value: a1, color: "hsl(var(--info))" },
                      { label: "Attempt 2", value: a2, color: "hsl(var(--info))" },
                      { label: "Attempt 3", value: a3, color: "hsl(var(--info))" },
                      { label: "Closed", value: closed, color: "hsl(var(--info))" },
                    ]}
                  />
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="pt-5">
                  <DonutChart
                    title="Lead source"
                    sub="Where leads came from"
                    centerLabel={srcRows.length ? `${Math.round((srcRows[0].leads / srcTotal) * 100)}%` : "0%"}
                    segments={srcRows.map((s, i) => ({ label: s.label, value: s.leads, color: DONUT_COLORS[i % DONUT_COLORS.length] }))}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        );
      })()}

      {/* ================= TREATMENTS ================= */}
      {tab === "treatments" && (() => {
        const services = ((tre?.by_service || []) as any[]).slice(0, 6);
        const plans = Number(tre?.package?.plans ?? 0);
        const avgSessions = plans > 0 ? (Number(tre?.adherence?.planned ?? 0) / plans).toFixed(1) : "0";
        return (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="Sessions completed" value={num(tt.completed)} tone="accent" />
              <KpiCard label="Package completion" value={`${Number(tre?.package?.avg_completion ?? 0)}%`} tone="success" />
              <KpiCard label="Most booked" value={services[0]?.service ?? "—"} tone="primary" />
              <KpiCard label="Avg. sessions/package" value={avgSessions} tone="warning" />
            </div>
            <Card className="shadow-card">
              <CardContent className="pt-5">
                <BarChartCard
                  title="Sessions by treatment type"
                  sub="Volume this period"
                  data={services.map((s) => ({ label: String(s.service ?? "—"), value: Number(s.total || 0) }))}
                  formatValue={(v) => (v > 0 ? String(v) : "")}
                />
              </CardContent>
            </Card>
          </>
        );
      })()}

      {/* ================= THERAPISTS ================= */}
      {tab === "therapists" && (() => {
        const list = ((the?.therapists || []) as any[]);
        const handled = list.reduce((s, t) => s + Number(t.completed || 0), 0);
        const busiest = list.slice().sort((a, b) => Number(b.completed || 0) - Number(a.completed || 0))[0];
        const avgPer = list.length ? (handled / list.length).toFixed(1) : "0";
        return (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="Therapists" value={num(list.length)} tone="accent" />
              <KpiCard label="Sessions handled" value={num(handled)} tone="success" />
              <KpiCard label="Busiest" value={busiest?.full_name ?? "—"} tone="primary" />
              <KpiCard label="Avg. sessions/therapist" value={avgPer} tone="warning" />
            </div>
            <Card className="shadow-card">
              <CardContent className="pt-5">
                <BarChartCard
                  title="Sessions per therapist"
                  sub="This period"
                  data={list.map((t) => ({ label: String(t.full_name ?? "—"), value: Number(t.completed || 0) }))}
                  formatValue={(v) => (v > 0 ? String(v) : "")}
                />
              </CardContent>
            </Card>
          </>
        );
      })()}
    </div>
  );
}

const DONUT_COLORS = [
  "hsl(var(--success))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--primary))",
  "hsl(var(--muted-foreground))",
];

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No data for this period</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={i === 0 ? "py-2" : "py-2 text-right"}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b last:border-0">
              {r.map((c, ci) => (
                <td key={ci} className={ci === 0 ? "py-2.5" : "py-2.5 text-right"}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
