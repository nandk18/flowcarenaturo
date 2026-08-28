import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { CallTask } from "./Sales";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PatientLink from "@/components/PatientLink";
import { MessageCircle, CheckCircle2, HeartHandshake, XCircle, CalendarClock, Phone, ChevronDown, AlertCircle, Clock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { formStorage } from "@/hooks/usePersistedForm";
import { getProfileId } from "@/utils/getProfileId";
import { buildMessage } from "@/lib/messageTemplates";
import { openWhatsApp } from "@/lib/whatsapp";
import { useUrlState } from "@/hooks/useUrlState";

type TomorrowAppt = {
  id: string;
  appointment_time: string | null;
  patient_id: string;
  patient: { id: string; name: string; phone: string | null } | null;
  doctor: { name: string | null } | null;
};

type CallLogEntry = {
  id: string;
  patient_id: string;
  called_at: string;
  outcome: string | null;
  notes: string | null;
  called_by: string | null;
  patient?: { id: string; name: string } | null;
  caller_name?: string | null;
};

type CareCallRow = {
  id: string;
  patient_id: string;
  appointment_date: string;
  appointment_time: string | null;
  care_call_due_date: string | null;
  patient: { id: string; name: string; phone: string | null } | null;
  doctor: { name: string | null } | null;
};

type CancelledRow = {
  id: string;
  patient_id: string;
  called_at: string;
  notes: string | null;
  patient: { id: string; name: string; phone: string | null } | null;
};

const INFORMED_PREFIX_RE = /^\[informed:([^\]]+)\]\s*/;

export default function CallTaskPage({ bare = false }: { bare?: boolean } = {}) {
  const { profile } = useAuth();
  const { clinic } = useClinic();
  const clinicId = profile?.clinic_id;
  const clinicName = clinic?.name ?? "our clinic";
  const [tomorrowAppts, setTomorrowAppts] = useState<TomorrowAppt[]>([]);
  const [calledMap, setCalledMap] = useState<Record<string, boolean>>({});
  const [doneCalls, setDoneCalls] = useState<CallLogEntry[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [careRows, setCareRows] = useState<CareCallRow[]>([]);
  const [careNotes, setCareNotes] = useState<Record<string, string>>({});
  const [cancelledRows, setCancelledRows] = useState<CancelledRow[]>([]);
  const [cancelNotes, setCancelNotes] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useUrlState("tab", "lead") as [
    "appt" | "care" | "cancel" | "lead" | "all",
    (v: "appt" | "care" | "cancel" | "lead" | "all") => void,
  ];
  const [statusTab, setStatusTab] = useUrlState("status", "overdue") as [
    "overdue" | "due" | "done",
    (v: "overdue" | "due" | "done") => void,
  ];
  const [leadCounts, setLeadCounts] = useState<{ overdue: number; due: number }>({ overdue: 0, due: 0 });
  const [leadTotal, setLeadTotal] = useState(0);

  const sendApptReminder = async (a: TomorrowAppt) => {
    if (!clinicId || !a.patient?.phone) return;
    const apptDate = format(addDays(new Date(), 1), "dd MMM yyyy");
    const apptTime = a.appointment_time ? a.appointment_time.slice(0, 5) : "";
    const msg = await buildMessage(clinicId, "appointment_reminder", {
      patient_name: a.patient?.name ?? "",
      clinic_name: clinicName,
      appointment_date: apptDate,
      appointment_time: apptTime,
      doctor_name: a.doctor?.name ?? "the doctor",
    });
    openWhatsApp(a.patient.phone, msg);
  };

  const setNoteForPatient = (patientId: string, value: string) => {
    setNoteMap((m) => ({ ...m, [patientId]: value }));
    if (value) formStorage.write(`call_note_${patientId}`, value);
    else formStorage.clear(`call_note_${patientId}`);
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const sevenAgoIso = new Date(Date.now() - 7 * 86400_000).toISOString();

  const loadAll = useCallback(async () => {
    if (!clinicId) return;
    try {
      const [apptsRes, callsRes, careRes, cancelRes, leadRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, appointment_time, patient_id, patients(id, name, phone), doctors(name)")
          .eq("clinic_id", clinicId)
          .eq("appointment_date", tomorrow)
          .not("status", "in", "(cancelled,completed)")
          .order("appointment_time"),
        supabase
          .from("call_logs")
          .select("id, patient_id, called_at, outcome, notes, called_by, patients(id, name)")
          .eq("clinic_id", clinicId)
          .gte("called_at", today + "T00:00:00")
          .lte("called_at", today + "T23:59:59")
          .order("called_at", { ascending: false }),
        (supabase as any)
          .from("appointments")
          .select("id, patient_id, appointment_date, appointment_time, care_call_due_date, patients(id, name, phone), doctors(name)")
          .eq("clinic_id", clinicId)
          .eq("care_call_required", true)
          .eq("care_call_done", false)
          .order("care_call_due_date", { ascending: true }),
        (supabase as any)
          .from("call_logs")
          .select("id, patient_id, called_at, notes, patients(id, name, phone)")
          .eq("clinic_id", clinicId)
          .eq("source", "appointment_cancelled")
          .gte("called_at", sevenAgoIso)
          .order("called_at", { ascending: false }),
        supabase
          .from("patients")
          .select("id, call_due_date", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .in("lead_status", ["attempt1", "attempt2", "attempt3"])
          .lte("call_due_date", today),
      ]);
      setLeadTotal(leadRes.count ?? 0);

      const appts = (apptsRes.data ?? []).map((x: any) => ({
        ...x,
        patient: Array.isArray(x.patients) ? x.patients[0] : x.patients,
        doctor: Array.isArray(x.doctors) ? x.doctors[0] : x.doctors,
      })) as TomorrowAppt[];
      setTomorrowAppts(appts);

      const restored: Record<string, string> = {};
      for (const a of appts) {
        const draft = formStorage.read<string>(`call_note_${a.patient_id}`, "");
        if (draft) restored[a.patient_id] = draft;
      }
      if (Object.keys(restored).length) {
        setNoteMap((m) => ({ ...restored, ...m }));
      }

      const calls = (callsRes.data ?? []).map((x: any) => ({
        ...x,
        patient: Array.isArray(x.patients) ? x.patients[0] : x.patients,
      })) as CallLogEntry[];

      const userIds = Array.from(new Set(calls.map((c) => c.called_by).filter(Boolean))) as string[];
      if (userIds.length) {
        try {
          const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
          const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
          calls.forEach((c) => { c.caller_name = c.called_by ? map.get(c.called_by) ?? null : null; });
        } catch (err) { console.error("[CallTaskPage profiles]", err); }
      }
      setDoneCalls(calls);

      const apptPidSet = new Set(appts.map((a) => a.patient_id));
      const called: Record<string, boolean> = {};
      calls.forEach((c) => { if (apptPidSet.has(c.patient_id)) called[c.patient_id] = true; });
      setCalledMap(called);

      // Care calls
      const care = ((careRes as any).data ?? []).map((r: any) => ({
        ...r,
        patient: Array.isArray(r.patients) ? r.patients[0] : r.patients,
        doctor: Array.isArray(r.doctors) ? r.doctors[0] : r.doctors,
      })) as CareCallRow[];
      setCareRows(care);
      const careRestored: Record<string, string> = {};
      care.forEach((r) => {
        const v = formStorage.read<string>(`care_call_note_${r.id}`, "");
        if (v) careRestored[r.id] = v;
      });
      if (Object.keys(careRestored).length) setCareNotes((m) => ({ ...careRestored, ...m }));

      // Cancelled appointments - filter out informed > 24h ago
      const cancelled = ((cancelRes as any).data ?? [])
        .map((r: any) => ({
          ...r,
          patient: Array.isArray(r.patients) ? r.patients[0] : r.patients,
        }))
        .filter((r: CancelledRow) => {
          const m = r.notes?.match(INFORMED_PREFIX_RE);
          if (!m) return true;
          const informedAt = new Date(m[1]).getTime();
          return Date.now() - informedAt < 24 * 3600_000;
        }) as CancelledRow[];
      setCancelledRows(cancelled);
    } catch (err) {
      console.error("[CallTaskPage loadAll]", err);
      setTomorrowAppts([]);
      setDoneCalls([]);
      setCareRows([]);
      setCancelledRows([]);
    }
  }, [clinicId, tomorrow, today, sevenAgoIso]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await loadAll(); } catch (err) { if (!cancelled) console.error("[CallTaskPage effect]", err); }
    })();
    return () => { cancelled = true; };
  }, [loadAll]);

  const markCalled = async (a: TomorrowAppt, outcome: string = "follow_up") => {
    if (!clinicId) return;
    const userId = await getProfileId();
    const typed = noteMap[a.patient_id]?.trim();
    const defaultNote = `Reminder call made for appointment on ${a.appointment_time ? format(addDays(new Date(), 1), "dd MMM yyyy") + " at " + a.appointment_time.slice(0, 5) : format(addDays(new Date(), 1), "dd MMM yyyy")} with ${a.doctor?.name ?? "doctor"}`;
    const note = typed && typed.length > 0 ? typed : defaultNote;

    const { error } = await supabase.from("call_logs").insert({
      patient_id: a.patient_id,
      clinic_id: clinicId,
      outcome,
      notes: `[${outcome}] ${note}`,
      called_by: userId,
      called_at: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("contact_notes").insert({
      patient_id: a.patient_id, clinic_id: clinicId, note: `Appt-tomorrow call (${outcome}): ${note}`, created_by: userId,
    });
    setCalledMap((m) => ({ ...m, [a.patient_id]: true }));
    setNoteMap((m) => { const n = { ...m }; delete n[a.patient_id]; return n; });
    formStorage.clear(`call_note_${a.patient_id}`);
    toast.success(`Logged as ${outcome.replace(/_/g, " ")}`);
    loadAll();
  };

  // ===== Care Call helpers =====
  const setCareNote = (id: string, v: string) => {
    setCareNotes((m) => ({ ...m, [id]: v }));
    if (v) formStorage.write(`care_call_note_${id}`, v);
    else formStorage.clear(`care_call_note_${id}`);
  };

  const sendCareWhatsApp = async (r: CareCallRow) => {
    if (!clinicId || !r.patient?.phone) return;
    const msg = await buildMessage(clinicId, "care_call", {
      patient_name: r.patient.name,
      clinic_name: clinicName,
    });
    openWhatsApp(r.patient.phone, msg);
  };

  const markCareCalled = async (r: CareCallRow, outcome: string = "doing_well") => {
    if (!clinicId) return;
    const userId = await getProfileId();
    const note = careNotes[r.id]?.trim();
    const combined = `Care call (${outcome.replace(/_/g, " ")})${note ? `: ${note}` : ""}`;
    await supabase.from("contact_notes").insert({
      patient_id: r.patient_id,
      clinic_id: clinicId,
      note: combined,
      created_by: userId,
    });
    await supabase.from("call_logs").insert({
      patient_id: r.patient_id,
      clinic_id: clinicId,
      outcome,
      notes: combined,
      called_by: userId,
      called_at: new Date().toISOString(),
    });
    const { error } = await (supabase as any)
      .from("appointments")
      .update({ care_call_done: true })
      .eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    formStorage.clear(`care_call_note_${r.id}`);
    toast.success(`Care call logged (${outcome.replace(/_/g, " ")})`);
    loadAll();
  };

  // ===== Cancelled helpers =====
  const parseReason = (notes: string | null) => {
    if (!notes) return "";
    const cleaned = notes.replace(INFORMED_PREFIX_RE, "");
    const m = cleaned.match(/Appointment cancelled:\s*(.*)/);
    return (m ? m[1] : cleaned).split(" - ")[0];
  };

  const isInformed = (notes: string | null) => !!notes?.match(INFORMED_PREFIX_RE);

  const setCancelNote = (id: string, v: string) => setCancelNotes((m) => ({ ...m, [id]: v }));

  const sendCancelWhatsApp = async (r: CancelledRow) => {
    if (!clinicId || !r.patient?.phone) return;
    const msg = await buildMessage(clinicId, "appointment_cancelled_notice", {
      patient_name: r.patient.name,
      clinic_name: clinicName,
      reason: parseReason(r.notes),
      appointment_date: "",
      appointment_time: "",
    });
    openWhatsApp(r.patient.phone, msg);
  };

  const markInformed = async (r: CancelledRow, outcome: string = "informed") => {
    if (!clinicId) return;
    const userId = await getProfileId();
    const extra = cancelNotes[r.id]?.trim();
    const informedNote = `Cancellation outcome (${outcome.replace(/_/g, " ")})${extra ? `: ${extra}` : ""}`;
    await supabase.from("contact_notes").insert({
      patient_id: r.patient_id,
      clinic_id: clinicId,
      note: informedNote,
      created_by: userId,
    });
    await supabase.from("call_logs").insert({
      patient_id: r.patient_id,
      clinic_id: clinicId,
      outcome,
      notes: informedNote,
      called_by: userId,
      called_at: new Date().toISOString(),
    });
    const newNotes = `[informed:${new Date().toISOString()}] ${(r.notes ?? "").replace(INFORMED_PREFIX_RE, "")}`;
    await (supabase as any).from("call_logs").update({ notes: newNotes }).eq("id", r.id);
    toast.success(`Marked ${outcome.replace(/_/g, " ")}`);
    loadAll();
  };

  const showType = (k: "appt" | "care" | "cancel" | "lead") =>
    activeTab === k || (activeTab as string) === "all";

  const visibleAppts = tomorrowAppts.filter((a) => {
    const called = !!calledMap[a.patient_id];
    if ((statusTab as string) === "done") return called;
    if (statusTab === "overdue") return false;
    return !called;
  });
  const visibleCare = careRows.filter((r) => {
    const due = r.care_call_due_date ?? "";
    if (statusTab === "overdue") return due && due < today;
    if (statusTab === "due") return due === today;
    return false;
  });
  const visibleCancel = cancelledRows.filter((r) => {
    const informed = isInformed(r.notes);
    const day = r.called_at.slice(0, 10);
    if ((statusTab as string) === "done") return informed && day === today;
    if (statusTab === "overdue") return !informed && day < today;
    return !informed && day === today;
  });
  const shownRowCount =
    (showType("appt") ? visibleAppts.length : 0) +
    (showType("care") ? visibleCare.length : 0) +
    (showType("cancel") ? visibleCancel.length : 0);

  const body = (

    <>
      {!clinicId ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading clinic...</div>
      ) : (
        <div className="space-y-5">
          {(() => {
            const overdueCount =
              cancelledRows.filter((r) => !isInformed(r.notes) && r.called_at.slice(0, 10) < today).length +
              careRows.filter((r) => r.care_call_due_date && r.care_call_due_date < today).length +
              leadCounts.overdue;
            const dueCount =
              tomorrowAppts.filter((a) => !calledMap[a.patient_id]).length +
              careRows.filter((r) => !r.care_call_due_date || r.care_call_due_date === today).length +
              cancelledRows.filter((r) => !isInformed(r.notes) && r.called_at.slice(0, 10) === today).length +
              leadCounts.due;
            const doneCount = doneCalls.length;
            const statusOptions: { key: "overdue" | "due" | "done"; label: string; count: number }[] = [
              { key: "overdue", label: "Overdue", count: overdueCount },
              { key: "due", label: "Due Today", count: dueCount },
              { key: "done", label: "Done Today", count: doneCount },
            ];
            const activeCount = statusOptions.find((s) => s.key === statusTab)?.count ?? 0;
            const totalTypeCount = tomorrowAppts.length + careRows.length + cancelledRows.filter((r) => !isInformed(r.notes)).length + leadTotal;
            const typeOptions: { key: "all" | "appt" | "care" | "cancel" | "lead"; label: string; icon: any; count: number }[] = [
              { key: "all", label: "All", icon: Clock, count: totalTypeCount },
              { key: "appt", label: "Appointment Tomorrow", icon: CalendarClock, count: tomorrowAppts.length },
              { key: "care", label: "Care Call", icon: HeartHandshake, count: careRows.length },
              { key: "cancel", label: "Cancelled Call", icon: XCircle, count: cancelledRows.filter((r) => !isInformed(r.notes)).length },
              { key: "lead", label: "Lead Call", icon: Phone, count: leadTotal },
            ];
            const activeType = typeOptions.find((t) => t.key === activeTab);
            const dotCls = { overdue: "bg-destructive", due: "bg-warning", done: "bg-success" } as const;
            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {statusOptions.map((s) => {
                    const active = statusTab === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setStatusTab(s.key)}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                          active ? "border-primary bg-primary/10 font-semibold text-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full", dotCls[s.key])} />
                        <span className="font-semibold">{s.count}</span>
                        <span>{s.key === "overdue" ? "overdue" : s.key === "due" ? "due today" : "done today"}</span>
                      </button>
                    );
                  })}
                </div>

                {statusTab !== "done" && (
                  <Select value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                    <SelectTrigger className="w-[220px]"><SelectValue placeholder="Type: All" /></SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((t) => (
                        <SelectItem key={t.key} value={t.key}>{t.key === "all" ? "Type: All" : t.label} ({t.count})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {statusTab !== "done" && (
                  <div
                    className={cn(
                      "flex items-center gap-2 px-1 pt-1 text-sm font-semibold",
                      statusTab === "overdue" ? "text-destructive" : "text-warning",
                    )}
                  >
                    {statusTab === "overdue" ? (
                      <AlertCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                    {statusOptions.find((s) => s.key === statusTab)?.label} — {activeType ? activeType.count : activeCount}
                  </div>
                )}
              </>
            );
          })()}

          {statusTab === "done" && (
            <section className="rounded-2xl border bg-card shadow-card overflow-hidden">
              <header className="flex items-center justify-between border-b bg-success/10 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Done today
                  <span className="ml-1 rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success">{doneCalls.length}</span>
                </h2>
                <span className="text-xs text-muted-foreground">All calls logged today</span>
              </header>
              {doneCalls.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No calls logged today yet</p>
              ) : (
                <ul className="divide-y">
                  {doneCalls.map((c) => {
                    const cleanNotes = (c.notes ?? "")
                      .replace(INFORMED_PREFIX_RE, "")
                      .replace(/^\[[^\]]+\]\s*/, "");
                    return (
                      <li key={c.id} className="px-4 py-3 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {c.patient ? (
                            <PatientLink patientId={c.patient.id} className="text-sm font-semibold">
                              {c.patient.name}
                            </PatientLink>
                          ) : (
                            <span className="text-sm">—</span>
                          )}
                          {c.outcome && (
                            <Badge variant="outline" className={cn("text-[10px] capitalize", outcomeStyle(c.outcome))}>
                              {outcomeLabel(c.outcome)}
                            </Badge>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">{format(new Date(c.called_at), "h:mm a")}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {c.caller_name && <span>by {c.caller_name}</span>}
                        </div>
                        {cleanNotes && <p className="text-xs text-muted-foreground">{cleanNotes}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {statusTab !== "done" && (
          <>


          {showType("appt") && visibleAppts.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 px-1 text-[12.5px] font-semibold text-info">
                <CalendarClock className="h-3.5 w-3.5" />
                Appointment tomorrow — {visibleAppts.length}
              </div>
              <ul className="space-y-2">
                {visibleAppts.map((a) => {
                  const called = calledMap[a.patient_id];
                  return (
                    <li key={a.id} className="grid gap-2 rounded-[10px] border bg-card px-3 py-2.5 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-info/10 text-info">
                          <CalendarClock className="h-3.5 w-3.5" />
                        </span>
                        {a.patient && (
                          <PatientLink patientId={a.patient.id} className="text-sm font-semibold">{a.patient.name}</PatientLink>
                        )}
                        <span className="text-xs text-muted-foreground">{a.appointment_time?.slice(0, 5)}</span>
                        <span className="text-xs text-muted-foreground">· {a.doctor?.name ?? "Doctor"}</span>
                        {a.patient?.phone && (
                          <>
                            <span className="text-xs text-muted-foreground">· {a.patient.phone}</span>
                            <button
                              type="button"
                              onClick={() => sendApptReminder(a)}
                              className="inline-flex items-center text-xs text-success hover:underline"
                              aria-label="Send WhatsApp reminder"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                      <Textarea
                        value={noteMap[a.patient_id] ?? ""}
                        onChange={(e) => setNoteForPatient(a.patient_id, e.target.value)}
                        placeholder="Add reminder note…"
                        rows={1}
                        className="min-h-[36px] text-sm sm:col-start-1 sm:col-span-2"
                      />
                      <div className="sm:row-start-1 sm:col-start-3 sm:row-span-2 sm:self-center">
                        {called ? (
                          <Badge variant="outline" className="border-success/30 text-success">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Called
                          </Badge>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm">Log Call <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => markCalled(a, "confirmed")}>Confirmed</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => markCalled(a, "rescheduled")}>Rescheduled</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => markCalled(a, "cancelled")}>Cancelled</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => markCalled(a, "no_answer")}>No Answer</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {showType("care") && visibleCare.length > 0 && (
            <section className="space-y-2">
              <div className={cn("flex items-center gap-2 px-1 text-[12.5px] font-semibold", statusTab === "overdue" ? "text-destructive" : "text-warning")}>
                <HeartHandshake className="h-3.5 w-3.5" />
                Care call — {visibleCare.length}
              </div>
              <ul className="space-y-2">
                {visibleCare.map((r) => {
                  const apptDate = new Date(r.appointment_date);
                  const daysSince = differenceInCalendarDays(new Date(), apptDate);
                  const overdue = (r.care_call_due_date ?? "") < today;
                  return (
                    <li key={r.id} className="grid gap-2 rounded-[10px] border bg-card px-3 py-2.5 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px]", overdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                            <HeartHandshake className="h-3.5 w-3.5" />
                          </span>
                          {r.patient && (
                            <PatientLink patientId={r.patient.id} className="text-sm font-semibold">
                              {r.patient.name}
                            </PatientLink>
                          )}
                          {r.patient?.phone && (
                            <>
                              <span className="text-xs text-muted-foreground">· {r.patient.phone}</span>
                              <button
                                type="button"
                                onClick={() => sendCareWhatsApp(r)}
                                className="inline-flex items-center text-xs text-success hover:underline"
                                aria-label="Send WhatsApp care call"
                              >
                                <MessageCircle className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>Visited {format(apptDate, "dd MMM")}</span>
                          <span>· {r.doctor?.name ?? "Doctor"}</span>
                          <span>· {daysSince}d ago</span>
                          {r.care_call_due_date && (
                            <span>· Due {format(new Date(r.care_call_due_date), "dd MMM")}</span>
                          )}
                        </div>
                        <Textarea
                          value={careNotes[r.id] ?? ""}
                          onChange={(e) => setCareNote(r.id, e.target.value)}
                          placeholder="Add care call note..."
                          rows={1}
                          className="min-h-[36px] text-sm"
                        />
                      </div>
                      <div className="sm:self-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm">Log Call <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => markCareCalled(r, "doing_well")}>Doing Well</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => markCareCalled(r, "needs_follow_up")}>Needs Follow-up</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => markCareCalled(r, "no_answer")}>No Answer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {showType("cancel") && visibleCancel.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 px-1 text-[12.5px] font-semibold text-warning">
                <XCircle className="h-3.5 w-3.5" />
                Cancelled appointments — {visibleCancel.length}
              </div>
              <ul className="space-y-2">
                {visibleCancel.map((r) => {
                  const informed = isInformed(r.notes);
                  const reason = parseReason(r.notes);
                  return (
                    <li key={r.id} className="grid gap-2 rounded-[10px] border bg-card px-3 py-2.5 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-warning/10 text-warning">
                            <XCircle className="h-3.5 w-3.5" />
                          </span>
                          {r.patient && (
                            <PatientLink patientId={r.patient.id} className="text-sm font-semibold">
                              {r.patient.name}
                            </PatientLink>
                          )}
                          {r.patient?.phone && (
                            <>
                              <span className="text-xs text-muted-foreground">· {r.patient.phone}</span>
                              <button
                                type="button"
                                onClick={() => sendCancelWhatsApp(r)}
                                className="inline-flex items-center text-xs text-success hover:underline"
                                aria-label="Send WhatsApp cancellation"
                              >
                                <MessageCircle className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>Cancelled {format(new Date(r.called_at), "dd MMM, h:mm a")}</span>
                          {reason && <span>· {reason}</span>}
                        </div>
                        {!informed && (
                          <Textarea
                            value={cancelNotes[r.id] ?? ""}
                            onChange={(e) => setCancelNote(r.id, e.target.value)}
                            placeholder="Add note about informing..."
                            rows={1}
                            className="min-h-[36px] text-sm"
                          />
                        )}
                      </div>
                      <div className="sm:self-center">
                        {informed ? (
                          <Badge variant="outline" className="border-success/30 text-success">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Informed
                          </Badge>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm">Log Call <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => markInformed(r, "rebooked")}>Rebooked</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => markInformed(r, "not_interested")}>Not Interested</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => markInformed(r, "no_answer")}>No Answer</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => markInformed(r, "informed")}>Informed</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {showType("lead") && (
            <CallTask
              clinicId={clinicId}
              onDoneClick={() => setShowDone(true)}
              doneTodayOverride={doneCalls.length}
              hidePills
              statusFilter={statusTab}
              onCountsChange={(c) => setLeadCounts(c)}
            />
          )}

          {!showType("lead") && shownRowCount === 0 && (
            <div className="rounded-xl border border-dashed bg-card px-7 py-8 text-center">
              <div className="mx-auto mb-3.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <p className="text-[14.5px] font-semibold">Rest of today's tasks are clear</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Nothing due right now — check back later.</p>
            </div>
          )}
          </>
          )}
        </div>

      )}

      <Sheet open={showDone} onOpenChange={setShowDone}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Completed Calls Today</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {doneCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No calls logged today yet</p>
            ) : doneCalls.map((c) => (
              <div key={c.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  {c.patient ? (
                    <PatientLink patientId={c.patient.id} className="text-sm font-semibold">{c.patient.name}</PatientLink>
                  ) : <span className="text-sm">—</span>}
                  <span className="text-xs text-muted-foreground">{format(new Date(c.called_at), "h:mm a")}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {c.outcome && (
                    <Badge variant="outline" className={cn("text-[10px] capitalize", outcomeStyle(c.outcome))}>
                      {outcomeLabel(c.outcome)}
                    </Badge>
                  )}
                  {c.caller_name && <span className="text-[11px] text-muted-foreground">by {c.caller_name}</span>}
                </div>
                {c.notes && <p className="mt-2 text-xs text-muted-foreground">{c.notes}</p>}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );

  return bare ? body : <DashboardLayout title="Call Task">{body}</DashboardLayout>;
}

function outcomeStyle(o: string) {
  switch (o) {
    case "no_answer": return "bg-gray-100 text-gray-700 border-gray-200";
    case "follow_up": return "bg-blue-100 text-blue-700 border-blue-200";
    case "not_interested": return "bg-red-100 text-red-700 border-red-200";
    case "cancelled": return "bg-red-100 text-red-700 border-red-200";
    case "booked":
    case "confirmed":
    case "rebooked":
    case "doing_well":
    case "informed": return "bg-green-100 text-green-700 border-green-200";
    case "rescheduled":
    case "needs_follow_up": return "bg-amber-100 text-amber-700 border-amber-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
}
function outcomeLabel(o: string) {
  return ({
    no_answer: "No Answer",
    follow_up: "Follow Up",
    not_interested: "Not Interested",
    booked: "Booked",
    confirmed: "Confirmed",
    rescheduled: "Rescheduled",
    cancelled: "Cancelled",
    rebooked: "Rebooked",
    informed: "Informed",
    doing_well: "Doing Well",
    needs_follow_up: "Needs Follow-up",
  } as any)[o] ?? o.replace(/_/g, " ");
}

