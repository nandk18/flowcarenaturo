import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stethoscope, ArrowRight, Plus, Calendar, CheckCircle2, Clock, Users, Eye, Play, Sparkles, X, CalendarClock, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PatientLink from "@/components/PatientLink";
import BookAppointmentModal from "@/components/appointments/BookAppointmentModal";
import CheckInModal, { type CheckInData } from "@/components/queue/CheckInModal";
import CancelAppointmentModal from "@/components/appointments/CancelAppointmentModal";
import RescheduleAppointmentModal from "@/components/appointments/RescheduleAppointmentModal";
import { format } from "date-fns";
import { formatDoctorName } from "@/lib/utils";
import { toast } from "sonner";

type ApptService = {
  service_id: string;
  invoice_services: { id: string; name: string; service_type: string | null; amount: number | null } | null;
};

type Appt = {
  id: string;
  clinic_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string | null;
  notes: string | null;
  patient_id: string;
  doctor_id: string;
  patient: { id: string; name: string; phone: string | null } | null;
  doctor: { name: string } | null;
  services: ApptService[];
};

type Visit = {
  id: string;
  patient_id: string;
  status: string;
};

type TxSession = { appointment_id: string | null; status: string };

type DisplayStatus = "waiting" | "scheduled" | "in_progress" | "completed" | "cancelled";

const statusStyle = (s: DisplayStatus) => {
  switch (s) {
    case "completed":
      return "bg-success/15 text-success border-success/30";
    case "in_progress":
      return "bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30";
    case "cancelled":
      return "bg-muted text-muted-foreground border-border";
    case "waiting":
      return "bg-warning/15 text-warning border-warning/30";
    case "scheduled":
      return "bg-info/15 text-info border-info/30";
  }
};

const statusLabel = (s: DisplayStatus) =>
  ({
    waiting: "Waiting",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  })[s];

// A mixed appointment (consult + treatment) appears in BOTH streams.
function hasTreatment(a: Appt): boolean {
  const svc = a.services ?? [];
  return svc.some((s) => (s.invoice_services?.service_type ?? "consultation") === "treatment");
}
function hasConsultation(a: Appt): boolean {
  const svc = a.services ?? [];
  // No linked services → treat as consultation (legacy default).
  if (svc.length === 0) return true;
  return svc.some((s) => (s.invoice_services?.service_type ?? "consultation") !== "treatment");
}


export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [visitsToday, setVisitsToday] = useState<Visit[]>([]);
  const [txSessions, setTxSessions] = useState<TxSession[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [bookOpen, setBookOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mode, setMode] = useState<"consult" | "treatment">("consult");

  // Modals for consult actions
  const [cancelAppt, setCancelAppt] = useState<Appt | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<Appt | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  const fetchAll = useCallback(async () => {
    if (!profile?.clinic_id) return;
    try {
      setFetchError(null);
      const [a, v, p, ts] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, clinic_id, appointment_date, appointment_time, status, reason, notes, patient_id, doctor_id, patients(id, name, phone), doctors(name), appointment_services(service_id, invoice_services(id, name, service_type, amount))")
          .eq("clinic_id", profile.clinic_id)
          .eq("appointment_date", today)
          .order("appointment_time"),
        supabase
          .from("visits")
          .select("id, patient_id, status")
          .eq("clinic_id", profile.clinic_id)
          .eq("visit_date", today),
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", profile.clinic_id),
        supabase
          .from("therapy_sessions")
          .select("appointment_id, status")
          .eq("clinic_id", profile.clinic_id)
          .eq("session_date", today),
      ]);
      if (a.error) throw a.error;
      setAppts(
        (a.data ?? []).map((x: any) => ({
          ...x,
          patient: Array.isArray(x.patients) ? x.patients[0] : x.patients,
          doctor: Array.isArray(x.doctors) ? x.doctors[0] : x.doctors,
          services: (x.appointment_services ?? []).map((s: any) => ({
            service_id: s.service_id,
            invoice_services: Array.isArray(s.invoice_services) ? s.invoice_services[0] : s.invoice_services,
          })),
        })),
      );
      setVisitsToday((v.data ?? []) as Visit[]);
      setTxSessions((ts.data ?? []) as TxSession[]);
      setTotalPatients(p.count ?? 0);
    } catch (err: any) {
      console.error("[AdminDashboard fetchAll]", err);
      setFetchError(err?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [profile?.clinic_id, today]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!profile?.clinic_id) return;
    const ch = supabase
      .channel("dash-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `clinic_id=eq.${profile.clinic_id}` },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visits", filter: `clinic_id=eq.${profile.clinic_id}` },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "therapy_sessions", filter: `clinic_id=eq.${profile.clinic_id}` },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile?.clinic_id, fetchAll]);

  // Treatment display driven by therapy_sessions ONLY (never appt.status).
  // This prevents a completed consultation flipping the treatment side to done.
  const getTxDisplay = useCallback(
    (a: Appt): "booked" | "in_progress" | "completed" | "cancelled" => {
      if (a.status === "cancelled") return "cancelled";
      const rows = txSessions.filter((s) => s.appointment_id === a.id);
      if (rows.length === 0) return "booked"; // no sessions yet → treatment hasn't started
      const active = rows.filter((s) => s.status !== "cancelled");
      if (active.length === 0) return "cancelled";
      if (active.every((s) => s.status === "completed")) return "completed";
      if (active.some((s) => s.status === "in_progress")) return "in_progress";
      if (active.some((s) => s.status === "completed")) return "in_progress"; // partial done
      return "booked";
    },
    [txSessions],
  );

  // Exclude cancelled from Consult/Treatment lists and top-level counts.
  const activeAppts = useMemo(() => appts.filter((a) => a.status !== "cancelled"), [appts]);

  const { consultAppts, treatmentAppts } = useMemo(() => {
    const c: Appt[] = [];
    const t: Appt[] = [];
    for (const a of activeAppts) {
      if (hasConsultation(a)) c.push(a);
      if (hasTreatment(a)) t.push(a);
    }
    return { consultAppts: c, treatmentAppts: t };
  }, [activeAppts]);


  const completedCount = activeAppts.filter((a) => a.status === "completed").length;
  const pendingCount = activeAppts.filter((a) => a.status === "scheduled" || a.status === "confirmed").length;

  // Consultation display: prefer visit status. For mixed appts, do NOT let appt.status=completed
  // (set when treatment sessions all complete) cascade back to the consult side.
  const getDisplay = (appt: Appt): DisplayStatus => {
    if (appt.status === "cancelled") return "cancelled";
    const v = visitsToday.find((x) => x.patient_id === appt.patient_id);
    if (v?.status === "completed") return "completed";
    if (v?.status === "in_progress") return "in_progress";
    if (v?.status === "waiting") return "waiting";
    // Consult-only legacy appointment marked completed without a visit row.
    if (!hasTreatment(appt) && appt.status === "completed") return "completed";
    if (!hasTreatment(appt) && appt.status === "in_progress") return "in_progress";
    return "scheduled";
  };


  const [startAppt, setStartAppt] = useState<Appt | null>(null);

  const startConsultation = async (appt: Appt, prereq: CheckInData | null) => {
    if (!profile?.clinic_id) return;
    let visit = visitsToday.find((v) => v.patient_id === appt.patient_id);
    if (!visit) {
      const { data: last } = await supabase
        .from("visits")
        .select("token_number")
        .eq("clinic_id", profile.clinic_id)
        .eq("visit_date", today)
        .order("token_number", { ascending: false })
        .limit(1)
        .maybeSingle();
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
      if (v) navigate(`/patients/${appt.patient_id}?tab=clinical&visit=${v.id}`);
      return;
    }
    if (display === "in_progress") {
      const v = visitsToday.find((x) => x.patient_id === appt.patient_id);
      if (v) navigate(`/dashboard/consultation/${v.id}`);
      return;
    }
    if (display === "waiting") {
      void startConsultation(appt, null);
      return;
    }
    setStartAppt(appt);
  };

  // === TREATMENT actions ===

  const startTreatment = async (appt: Appt) => {
    if (!profile?.clinic_id || !appt.patient_id) return;
    const { startTreatmentForAppointment } = await import("@/lib/treatmentStart");
    const result = await startTreatmentForAppointment({
      id: appt.id,
      clinic_id: profile.clinic_id,
      patient_id: appt.patient_id,
      notes: appt.notes,
      services: appt.services ?? [],
    });
    if (!result.ok) {
      toast.error(result.error || "Could not start treatment");
      return;
    }
    const fromPlan = result.usedFromPlan - result.createdIndividual;
    toast.success(
      `Started ${result.createdSessions} treatment session(s)${result.usedFromPlan > 0 ? ` · ${fromPlan} from plan${result.createdIndividual > 0 ? ` · ${result.createdIndividual} individual` : ""}` : ""}`,
    );
    navigate("/treatment/board");
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Clinical Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today's appointments and consultations</p>
      </div>

      {fetchError && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <span className="text-destructive">Failed to load: {fetchError}</span>
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); void fetchAll(); }}>Retry</Button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Calendar} label="Today's Appointments" value={activeAppts.length} color="text-info" />
        <StatCard icon={CheckCircle2} label="Completed" value={completedCount} color="text-success" />
        <StatCard icon={Clock} label="Pending" value={pendingCount} color="text-warning" />
        <StatCard icon={Users} label="Total Patients" value={totalPatients} color="text-primary" />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border bg-muted/50 p-1">
          <button
            onClick={() => setMode("consult")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "consult" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Stethoscope className="h-4 w-4" /> Consultations
            <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px]">{consultAppts.length}</Badge>
          </button>
          <button
            onClick={() => setMode("treatment")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "treatment" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4" /> Treatments
            <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px]">{treatmentAppts.length}</Badge>
          </button>
        </div>
        <Button onClick={() => setBookOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Walk-in / Book Appointment
        </Button>
      </div>

      {mode === "consult" ? (
        <ConsultationTabs
          appts={consultAppts}
          loading={loading}
          getDisplay={getDisplay}
          handleAction={handleAction}
          onBook={() => setBookOpen(true)}
          onCancel={setCancelAppt}
          onReschedule={setRescheduleAppt}
        />
      ) : (
        <TreatmentTabs
          appts={treatmentAppts}
          loading={loading}
          getTxDisplay={getTxDisplay}
          onStartTreatment={startTreatment}
          onCancel={setCancelAppt}
          onReschedule={setRescheduleAppt}
          onBook={() => setBookOpen(true)}
          onView={(a) => navigate(`/patients/${a.patient_id}?tab=treatment`)}
        />
      )}

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

      <CancelAppointmentModal
        open={!!cancelAppt}
        onClose={() => setCancelAppt(null)}
        onCancelled={fetchAll}
        appointment={
          cancelAppt
            ? {
                id: cancelAppt.id,
                clinic_id: cancelAppt.clinic_id,
                patient_id: cancelAppt.patient_id,
                appointment_date: cancelAppt.appointment_date,
                appointment_time: cancelAppt.appointment_time,
                patient_name: cancelAppt.patient?.name ?? "Patient",
                patient_phone: cancelAppt.patient?.phone ?? null,
              }
            : null
        }
      />

      <RescheduleAppointmentModal
        open={!!rescheduleAppt}
        onClose={() => setRescheduleAppt(null)}
        onRescheduled={fetchAll}
        appointment={
          rescheduleAppt
            ? {
                id: rescheduleAppt.id,
                clinic_id: rescheduleAppt.clinic_id,
                patient_id: rescheduleAppt.patient_id,
                doctor_id: rescheduleAppt.doctor_id,
                appointment_date: rescheduleAppt.appointment_date,
                appointment_time: rescheduleAppt.appointment_time,
                patient_name: rescheduleAppt.patient?.name ?? "Patient",
                doctor_name: rescheduleAppt.doctor?.name ?? null,
                reason: rescheduleAppt.reason,
                notes: rescheduleAppt.notes,
              }
            : null
        }
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
  appts,
  loading,
  getDisplay,
  handleAction,
  onBook,
  onCancel,
  onReschedule,
}: {
  appts: Appt[];
  loading: boolean;
  getDisplay: (a: Appt) => DisplayStatus;
  handleAction: (a: Appt) => void;
  onBook: () => void;
  onCancel: (a: Appt) => void;
  onReschedule: (a: Appt) => void;
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
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Stethoscope className="mb-4 h-16 w-16 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">
              {tab === "active" ? "No active consultations" : "No completed consultations today"}
            </p>
            {tab === "active" && (
              <Button variant="outline" className="mt-4" onClick={onBook}>
                <Plus className="mr-1 h-4 w-4" /> Book Appointment
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((appt) => {
            const display = getDisplay(appt);
            const canModify = display === "scheduled" || display === "waiting" || display === "in_progress";
            return (
              <Card key={appt.id} className="shadow-card">
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="font-mono text-xs font-bold text-primary w-14">
                    {appt.appointment_time?.substring(0, 5)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {appt.patient && (
                        <PatientLink patientId={appt.patient.id} className="truncate">
                          {appt.patient.name}
                        </PatientLink>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${statusStyle(display)}`}>
                        {statusLabel(display)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDoctorName(appt.doctor?.name)}
                      {appt.reason && ` · ${appt.reason}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {display === "completed" ? (
                      <Button size="sm" variant="outline" onClick={() => handleAction(appt)}>
                        <Eye className="mr-1 h-3 w-3" /> View Summary
                      </Button>
                    ) : display === "cancelled" ? null : (
                      <>
                        {canModify && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => onReschedule(appt)} title="Reschedule">
                              <CalendarClock className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onCancel(appt)} title="Cancel">
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant={display === "in_progress" ? "outline" : "default"} onClick={() => handleAction(appt)}>
                          {display === "in_progress" ? (
                            <><Play className="mr-1 h-3 w-3" /> Continue</>
                          ) : (
                            <><ArrowRight className="mr-1 h-3 w-3" /> Start Consultation</>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function TreatmentTabs({
  appts,
  loading,
  getTxDisplay,
  onStartTreatment,
  onCancel,
  onReschedule,
  onBook,
  onView,
}: {
  appts: Appt[];
  loading: boolean;
  getTxDisplay: (a: Appt) => "booked" | "in_progress" | "completed" | "cancelled";
  onStartTreatment: (a: Appt) => void;
  onCancel: (a: Appt) => void;
  onReschedule: (a: Appt) => void;
  onBook: () => void;
  onView: (a: Appt) => void;
}) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const active = appts.filter((a) => {
    const d = getTxDisplay(a);
    return d === "booked" || d === "in_progress";
  });
  const completed = appts.filter((a) => getTxDisplay(a) === "completed");
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
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Sparkles className="mb-4 h-16 w-16 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">
              {tab === "active" ? "No treatments booked for today" : "No completed treatments today"}
            </p>
            {tab === "active" && (
              <Button variant="outline" className="mt-4" onClick={onBook}>
                <Plus className="mr-1 h-4 w-4" /> Book Treatment
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((appt) => {
            const svcNames = (appt.services ?? [])
              .map((s) => s.invoice_services?.name)
              .filter(Boolean) as string[];
            const display = getTxDisplay(appt);
            const isInProgress = display === "in_progress";
            const isCompleted = display === "completed";
            const canModify = display === "booked";
            return (
              <Card key={appt.id} className="shadow-card">
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="font-mono text-xs font-bold text-primary w-14">
                    {appt.appointment_time?.substring(0, 5)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {appt.patient && (
                        <PatientLink patientId={appt.patient.id} className="truncate">
                          {appt.patient.name}
                        </PatientLink>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          isCompleted
                            ? "bg-success/15 text-success border-success/30"
                            : isInProgress
                            ? "bg-orange-500/15 text-orange-700 border-orange-500/30"
                            : "bg-info/15 text-info border-info/30"
                        }`}
                      >
                        {isCompleted ? "Completed" : isInProgress ? "On Board" : "Booked"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {svcNames.length > 0 ? svcNames.join(", ") : "Treatment"}
                      {appt.notes && ` · 📝 ${appt.notes}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCompleted ? (
                      <Button size="sm" variant="outline" onClick={() => onView(appt)}>
                        <Eye className="mr-1 h-3 w-3" /> View
                      </Button>
                    ) : isInProgress ? (
                      <Button size="sm" variant="outline" onClick={() => onView(appt)}>
                        <Activity className="mr-1 h-3 w-3" /> On Board
                      </Button>
                    ) : (
                      <>
                        {canModify && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => onReschedule(appt)} title="Reschedule">
                              <CalendarClock className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onCancel(appt)} title="Cancel">
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" onClick={() => onStartTreatment(appt)}>
                          <Play className="mr-1 h-3 w-3" /> Start Treatment
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
