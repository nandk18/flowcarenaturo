import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stethoscope, ArrowRight, Plus, Calendar, CheckCircle2, Clock, Users, Eye, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PatientLink from "@/components/PatientLink";
import BookAppointmentModal from "@/components/appointments/BookAppointmentModal";
import CheckInModal, { type CheckInData } from "@/components/queue/CheckInModal";
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

type DisplayStatus = "waiting" | "scheduled" | "in_progress" | "completed" | "cancelled";

const statusStyle = (s: DisplayStatus) => {
  switch (s) {
    case "completed": return "bg-success/15 text-success border-success/30";
    case "in_progress": return "bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30";
    case "cancelled": return "bg-muted text-muted-foreground border-border";
    case "waiting": return "bg-warning/15 text-warning border-warning/30";
    case "scheduled": return "bg-info/15 text-info border-info/30";
  }
};

const statusLabel = (s: DisplayStatus) => ({
  waiting: "Waiting",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
}[s]);

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

  // Determine display status: if a visit exists today for the patient, use its status
  const getDisplay = (appt: Appt): DisplayStatus => {
    if (appt.status === "completed") return "completed";
    if (appt.status === "cancelled") return "cancelled";
    const v = visitsToday.find((x) => x.patient_id === appt.patient_id);
    if (v?.status === "in_progress") return "in_progress";
    if (v?.status === "completed") return "completed";
    if (v?.status === "waiting") return "waiting";
    return "scheduled";
  };

  // Walk-in flow: open CheckIn prerequisites then create visit + open consultation
  const [startAppt, setStartAppt] = useState<Appt | null>(null);

  const startConsultation = async (appt: Appt, prereq: CheckInData | null) => {
    if (!profile?.clinic_id) return;
    let visit = visitsToday.find((v) => v.patient_id === appt.patient_id);
    if (!visit) {
      const { data: last } = await supabase.from("visits")
        .select("token_number").eq("clinic_id", profile.clinic_id)
        .eq("visit_date", today).order("token_number", { ascending: false }).limit(1).maybeSingle();
      const nextToken = ((last as any)?.token_number ?? 0) + 1;
      const payload: any = {
        clinic_id: profile.clinic_id,
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        token_number: nextToken,
        chief_complaint: prereq?.chief_complaint || appt.reason || null,
        status: "in_progress",
        visit_date: today,
      };
      if (prereq) {
        payload.lifestyle = prereq.lifestyle;
        payload.height_cm = prereq.height_cm;
        payload.weight_kg = prereq.weight_kg;
        payload.captured_at_reception = true;
      }
      const { data: created, error } = await supabase.from("visits").insert(payload).select("id").single();
      if (error) return;
      visit = { id: created!.id, patient_id: appt.patient_id, status: "in_progress" };
    } else if (visit.status === "waiting") {
      await supabase.from("visits").update({ status: "in_progress" }).eq("id", visit.id);
    }
    await supabase.from("appointments").update({ status: "in_progress" }).eq("id", appt.id);
    navigate(`/dashboard/consultation/${visit.id}`);
  };

  const handleAction = (appt: Appt) => {
    const display = getDisplay(appt);
    if (display === "completed") {
      const v = visitsToday.find((x) => x.patient_id === appt.patient_id);
      if (v) navigate(`/dashboard/consultation/${v.id}`);
      return;
    }
    if (display === "in_progress") {
      const v = visitsToday.find((x) => x.patient_id === appt.patient_id);
      if (v) navigate(`/dashboard/consultation/${v.id}`);
      return;
    }
    if (display === "waiting") {
      // Walk-in already has prereqs (or skipped) — go straight in
      void startConsultation(appt, null);
      return;
    }
    // Scheduled → prompt prerequisites first
    setStartAppt(appt);
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

      <ConsultationTabs
        appts={appts}
        loading={loading}
        getDisplay={getDisplay}
        handleAction={handleAction}
        onBook={() => setBookOpen(true)}
      />


      <BookAppointmentModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onBooked={fetchAll}
        initialDate={today}
        lockDate
        walkInFlow
      />

      <CheckInModal
        open={!!startAppt}
        patientName={startAppt?.patient?.name ?? ""}
        appointmentTime={startAppt?.appointment_time?.substring(0, 5)}
        onClose={() => setStartAppt(null)}
        onConfirm={async (data) => {
          if (startAppt) await startConsultation(startAppt, data);
          setStartAppt(null);
        }}
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

function ConsultationTabs({
  appts, loading, getDisplay, handleAction, onBook,
}: {
  appts: Appt[];
  loading: boolean;
  getDisplay: (a: Appt) => DisplayStatus;
  handleAction: (a: Appt) => void;
  onBook: () => void;
}) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const active = appts.filter((a) => {
    const d = getDisplay(a);
    return d === "scheduled" || d === "in_progress" || d === "waiting";
  });
  const completed = appts.filter((a) => getDisplay(a) === "completed");
  const list = tab === "active" ? active : completed;

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-3">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : list.length === 0 ? (
        <Card className="shadow-card"><CardContent className="flex flex-col items-center justify-center py-16">
          <Stethoscope className="mb-4 h-16 w-16 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            {tab === "active" ? "No active consultations" : "No completed consultations today"}
          </p>
          {tab === "active" && (
            <Button variant="outline" className="mt-4" onClick={onBook}>
              <Plus className="mr-1 h-4 w-4" /> Book Appointment
            </Button>
          )}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {list.map((appt) => {
            const display = getDisplay(appt);
            return (
              <Card key={appt.id} className="shadow-card">
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="font-mono text-xs font-bold text-primary w-14">{appt.appointment_time?.substring(0, 5)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {appt.patient && <PatientLink patientId={appt.patient.id} className="truncate">{appt.patient.name}</PatientLink>}
                      <Badge variant="outline" className={`text-[10px] ${statusStyle(display)}`}>{statusLabel(display)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDoctorName(appt.doctor?.name)}
                      {appt.reason && ` · ${appt.reason}`}
                    </p>
                  </div>
                  {display === "completed" ? (
                    <Button size="sm" variant="outline" onClick={() => handleAction(appt)}>
                      <Eye className="mr-1 h-3 w-3" /> View Summary
                    </Button>
                  ) : display === "in_progress" ? (
                    <Button size="sm" variant="outline" onClick={() => handleAction(appt)}>
                      <Play className="mr-1 h-3 w-3" /> Continue
                    </Button>
                  ) : display === "cancelled" ? null : (
                    <Button size="sm" onClick={() => handleAction(appt)}>
                      <ArrowRight className="mr-1 h-3 w-3" /> Start Consultation
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

