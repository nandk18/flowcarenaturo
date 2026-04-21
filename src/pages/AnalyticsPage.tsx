import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Stethoscope, FileText, TrendingUp, Download, BarChart2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import { toast } from "sonner";
import { format, subDays, subMonths, startOfYear, startOfWeek, startOfMonth, startOfDay } from "date-fns";

const RANGES = ["Today", "This Week", "This Month", "Last 3 Months", "This Year"] as const;
type Range = typeof RANGES[number];

function getDateRange(range: Range): { start: string; end: string } {
  const now = new Date();
  const end = format(now, "yyyy-MM-dd");
  switch (range) {
    case "Today": return { start: format(startOfDay(now), "yyyy-MM-dd"), end };
    case "This Week": return { start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), end };
    case "This Month": return { start: format(startOfMonth(now), "yyyy-MM-dd"), end };
    case "Last 3 Months": return { start: format(subMonths(now, 3), "yyyy-MM-dd"), end };
    case "This Year": return { start: format(startOfYear(now), "yyyy-MM-dd"), end };
  }
}

function getDayCount(range: Range): number {
  const { start, end } = getDateRange(range);
  return Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))"];

export default function AnalyticsPage() {
  const { profile } = useAuth();
  const [range, setRange] = useState<Range>("This Month");
  const [loading, setLoading] = useState(true);

  // Raw data
  const [visits, setVisits] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);

  const clinicId = profile?.clinic_id;
  const { start, end } = useMemo(() => getDateRange(range), [range]);

  const fetchData = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const [vRes, pRes, rxRes, nRes, dRes, sRes] = await Promise.all([
      supabase.from("visits").select("id, visit_date, status, doctor_id, patient_id, created_at").eq("clinic_id", clinicId).gte("visit_date", start).lte("visit_date", end),
      supabase.from("patients").select("id, gender, blood_group, created_at").eq("clinic_id", clinicId),
      supabase.from("prescriptions").select("id, medications, created_at, visit_id").gte("created_at", `${start}T00:00:00`).lte("created_at", `${end}T23:59:59`),
      supabase.from("clinical_notes").select("soap_notes, created_at, visit_id").gte("created_at", `${start}T00:00:00`).lte("created_at", `${end}T23:59:59`),
      supabase.from("doctors").select("id, name").eq("clinic_id", clinicId),
      supabase.from("document_shares").select("id, shared_via, prescription_id, shared_at").gte("shared_at", `${start}T00:00:00`).lte("shared_at", `${end}T23:59:59`),
    ]);
    setVisits(vRes.data || []);
    setPatients(pRes.data || []);
    setPrescriptions(rxRes.data || []);
    setNotes(nRes.data || []);
    setDoctors(dRes.data || []);
    setShares(sRes.data || []);
    setLoading(false);
  }, [clinicId, start, end]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Computed stats
  const uniquePatientIds = useMemo(() => new Set(visits.map(v => v.patient_id)), [visits]);
  const totalPatients = uniquePatientIds.size;
  const newPatients = useMemo(() => patients.filter(p => p.created_at >= `${start}T00:00:00`).length, [patients, start]);
  const totalVisits = visits.length;
  const completedVisits = visits.filter(v => v.status === "completed").length;
  const inProgressVisits = visits.filter(v => v.status === "in_progress").length;
  const totalPrescriptions = prescriptions.length;
  const whatsappShares = shares.filter(s => s.shared_via === "whatsapp").length;
  const days = getDayCount(range);
  const avgPerDay = days > 0 ? (totalVisits / days).toFixed(1) : "0";

  // Peak day
  const peakDay = useMemo(() => {
    const counts: Record<string, number> = {};
    visits.forEach(v => { counts[v.visit_date] = (counts[v.visit_date] || 0) + 1; });
    let max = 0, date = "";
    Object.entries(counts).forEach(([d, c]) => { if (c > max) { max = c; date = d; } });
    return { date, count: max };
  }, [visits]);

  // Chart: visits over time
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    visits.forEach(v => { counts[v.visit_date] = (counts[v.visit_date] || 0) + 1; });
    return Object.entries(counts).sort().map(([date, count]) => ({
      date: format(new Date(date), "dd MMM"), count
    }));
  }, [visits]);

  // Top diagnoses
  const topDiagnoses = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(n => {
      const soap = n.soap_notes as any;
      const assessment = soap?.assessment || soap?.Assessment;
      if (assessment && typeof assessment === "string" && assessment.trim()) {
        const key = assessment.trim().substring(0, 80);
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([diagnosis, count]) => ({ diagnosis, count }));
  }, [notes]);

  // Top medications
  const topMedications = useMemo(() => {
    const counts: Record<string, number> = {};
    prescriptions.forEach(p => {
      (p.medications as any[])?.forEach(m => {
        if (m?.name) counts[m.name] = (counts[m.name] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
  }, [prescriptions]);

  // Doctor performance
  const doctorStats = useMemo(() => {
    const map: Record<string, { name: string; total: number; completed: number; prescriptions: number }> = {};
    doctors.forEach(d => { map[d.id] = { name: d.name, total: 0, completed: 0, prescriptions: 0 }; });
    visits.forEach(v => {
      if (v.doctor_id && map[v.doctor_id]) {
        map[v.doctor_id].total++;
        if (v.status === "completed") map[v.doctor_id].completed++;
      }
    });
    // Count prescriptions per doctor via visit
    const visitDoctorMap: Record<string, string> = {};
    visits.forEach(v => { if (v.doctor_id) visitDoctorMap[v.id] = v.doctor_id; });
    prescriptions.forEach(p => {
      const did = visitDoctorMap[p.visit_id];
      if (did && map[did]) map[did].prescriptions++;
    });
    return Object.values(map).filter(d => d.total > 0).sort((a, b) => b.total - a.total);
  }, [doctors, visits, prescriptions]);

  // Gender split
  const genderData = useMemo(() => {
    const counts = { Male: 0, Female: 0, Other: 0 };
    patients.forEach(p => {
      if (p.gender === "male" || p.gender === "Male") counts.Male++;
      else if (p.gender === "female" || p.gender === "Female") counts.Female++;
      else counts.Other++;
    });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [patients]);

  // Blood group
  const bloodGroupData = useMemo(() => {
    const counts: Record<string, number> = {};
    patients.forEach(p => {
      if (p.blood_group) counts[p.blood_group] = (counts[p.blood_group] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [patients]);

  const BG_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#ec4899", "#6366f1"];

  const exportCSV = () => {
    const rows = [
      ["Metric", "Value"],
      ["Total Patients", totalPatients],
      ["New Patients", newPatients],
      ["Total Consultations", totalVisits],
      ["Completed", completedVisits],
      ["Prescriptions", totalPrescriptions],
      ["Avg/Day", avgPerDay],
      [""],
      ["Date", "Patients"],
      ...chartData.map(d => [d.date, d.count]),
      [""],
      ["Diagnosis", "Count"],
      ...topDiagnoses.map(d => [d.diagnosis, d.count]),
      [""],
      ["Medication", "Times Prescribed"],
      ...topMedications.map(m => [m.name, m.count]),
    ].map(r => (r as any[]).join(",")).join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clinic-analytics-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Report downloaded");
  };

  const statCards = [
    { label: "Total Patients", value: totalPatients, icon: Users, sub: `+${newPatients} new this period` },
    { label: "Total Consultations", value: totalVisits, icon: Stethoscope, sub: `${completedVisits} completed · ${inProgressVisits} in progress` },
    { label: "Prescriptions", value: totalPrescriptions, icon: FileText, sub: `${whatsappShares} shared via WhatsApp` },
    { label: "Avg Patients/Day", value: avgPerDay, icon: TrendingUp, sub: peakDay.date ? `Peak: ${peakDay.count} on ${format(new Date(peakDay.date), "dd MMM")}` : "No data" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart2 className="h-6 w-6 text-primary" /> Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Clinic performance insights</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RANGES.map(r => (
              <Button key={r} size="sm" variant={range === r ? "default" : "outline"} className="text-xs" onClick={() => setRange(r)}>
                {r}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statCards.map(s => (
                <Card key={s.label} className="shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <s.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{s.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Consultations chart */}
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Consultations Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No consultation data for this period</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Diagnoses + Medications */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top Diagnoses</CardTitle></CardHeader>
                <CardContent>
                  {topDiagnoses.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No diagnosis data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={topDiagnoses} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis dataKey="diagnosis" type="category" tick={{ fontSize: 10 }} width={140} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top Medications</CardTitle></CardHeader>
                <CardContent>
                  {topMedications.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No medication data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={topMedications} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={140} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Doctor Performance */}
            {doctorStats.length > 0 && (
              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Doctor Performance</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground text-xs">
                          <th className="py-2">Doctor</th>
                          <th className="py-2 text-right">Consultations</th>
                          <th className="py-2 text-right">Completed</th>
                          <th className="py-2 text-right">Prescriptions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doctorStats.map(d => (
                          <tr key={d.name} className="border-b last:border-0">
                            <td className="py-2 font-medium text-foreground">{d.name}</td>
                            <td className="py-2 text-right text-foreground">{d.total}</td>
                            <td className="py-2 text-right text-primary">{d.completed}</td>
                            <td className="py-2 text-right text-accent-foreground">{d.prescriptions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Demographics */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Gender Distribution</CardTitle></CardHeader>
                <CardContent>
                  {genderData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No patient data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
                          {genderData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Blood Group Distribution</CardTitle></CardHeader>
                <CardContent>
                  {bloodGroupData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No blood group data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={bloodGroupData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
                          {bloodGroupData.map((_, i) => <Cell key={i} fill={BG_COLORS[i % BG_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Export */}
            <div className="flex justify-end">
              <Button variant="outline" onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" /> Export CSV Report
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
