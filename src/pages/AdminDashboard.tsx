import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stethoscope, ArrowRight, Plus, Calendar, CheckCircle2, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PatientLink from "@/components/PatientLink";
import BookAppointmentModal from "@/components/appointments/BookAppointmentModal";
import { format } from "date-fns";
import { formatDoctorName } from "@/lib/utils";

type Appt = {
  id: string;
  appointment_time: string;
  status: string;
  reason: string | null;
  patient_id: string;
  doctor_id: string;
  patient: { id: string; name: string } | null;
  doctor: { name: string } | null;
};

type Visit = {
  id: string;
  patient_id: string;
  status: string;
};

const statusBadge = (s: string) => {
  switch (s) {
    case "completed": return "bg-success/15 text-success border-success/30";
    case "in_progress": return "bg-info/15 text-info border-info/30";
    case "cancelled": return "bg-destructive/15 text-destructive border-destructive/30";
    default: return "bg-warning/15 text-warning border-warning/30";
  }
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [visitsToday, setVisitsToday] = useState<Visit[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [bookOpen, setBookOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");

  const fetchAll = useCallback(async () => {
    if (!profile?.clinic_id) return;
    const [a, v, p] = await Promise.all([
      supabase.from("appointments")
        .select("id, appointment_time, status, reason, patient_id, doctor_id, patients(id, name), doctors(name)")
        .eq("clinic_id", profile.clinic_id)
        .eq("appointment_date", today)
        .order("appointment_time"),
      supabase.from("visits")
        .select("id, patient_id, status")
        .eq("clinic_id", profile.clinic_id)
        .eq("visit_date", today),
      supabase.from("patients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", profile.clinic_id),
    ]);
    setAppts((a.data ?? []).map((x: any) => ({
      ...x,
      patient: Array.isArray(x.patients) ? x.patients[0] : x.patients,
      doctor: Array.isArray(x.doctors) ? x.doctors[0] : x.doctors,
    })));
    setVisitsToday((v.data ?? []) as Visit[]);
    setTotalPatients(p.count ?? 0);
    setLoading(false);
  }, [profile?.clinic_id, today]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!profile?.clinic_id) return;
    const ch = supabase.channel("dash-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `clinic_id=eq.${profile.clinic_id}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "visits", filter: `clinic_id=eq.${profile.clinic_id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.clinic_id, fetchAll]);

  const completedCount = appts.filter((a) => a.status === "completed").length;
  const pendingCount = appts.filter((a) => a.status === "scheduled" || a.status === "confirmed").length;

  const handleStart = async (appt: Appt) => {
    if (!profile?.clinic_id) return;
    // Find or create visit
    let visit = visitsToday.find((v) => v.patient_id === appt.patient_id);
    if (!visit) {
      const { data: last } = await supabase.from("visits")
        .select("token_number").eq("clinic_id", profile.clinic_id)
        .eq("visit_date", today).order("token_number", { ascending: false }).limit(1).maybeSingle();
      const nextToken = ((last as any)?.token_number ?? 0) + 1;
      const { data: created, error } = await supabase.from("visits").insert({
        clinic_id: profile.clinic_id,
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        token_number: nextToken,
        chief_complaint: appt.reason,
        status: "in_progress",
        visit_date: today,
      } as any).select("id").single();
      if (error) return;
      visit = { id: created!.id, patient_id: appt.patient_id, status: "in_progress" };
    } else if (visit.status === "waiting") {
      await supabase.from("visits").update({ status: "in_progress" }).eq("id", visit.id);
    }
    navigate(`/dashboard/consultation/${visit.id}`);
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Clinical Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today's appointments and consultations</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Calendar} label="Today's Appointments" value={appts.length} color="text-info" />
        <StatCard icon={CheckCircle2} label="Completed" value={completedCount} color="text-success" />
        <StatCard icon={Clock} label="Pending" value={pendingCount} color="text-warning" />
        <StatCard icon={Users} label="Total Patients" value={totalPatients} color="text-primary" />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Today's Consultations</h2>
        <Button onClick={() => setBookOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Walk-in / Book Appointment
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : appts.length === 0 ? (
        <Card className="shadow-card"><CardContent className="flex flex-col items-center justify-center py-16">
          <Stethoscope className="mb-4 h-16 w-16 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No appointments today</p>
          <Button variant="outline" className="mt-4" onClick={() => setBookOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Book Appointment
          </Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {appts.map((appt) => (
            <Card key={appt.id} className="shadow-card">
              <CardContent className="flex items-center gap-3 p-3">
                <span className="font-mono text-xs font-bold text-primary w-14">{appt.appointment_time?.substring(0, 5)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {appt.patient && <PatientLink patientId={appt.patient.id} className="truncate font-medium">{appt.patient.name}</PatientLink>}
                    <Badge variant="outline" className={`text-[10px] capitalize ${statusBadge(appt.status)}`}>{appt.status?.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatDoctorName(appt.doctor?.name)}
                    {appt.reason && ` · ${appt.reason}`}
                  </p>
                </div>
                <Button size="sm" onClick={() => handleStart(appt)} disabled={appt.status === "completed" || appt.status === "cancelled"}>
                  <ArrowRight className="mr-1 h-3 w-3" /> Start Consultation
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BookAppointmentModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onBooked={fetchAll}
        initialDate={today}
        lockDate
      />
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
