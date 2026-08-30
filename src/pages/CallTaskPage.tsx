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
import CallTaskRow from "@/components/dailyops/CallTaskRow";
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
  const [statusTab, setStatusTab] = useUrlState("status", "all") as [
    "all" | "overdue" | "due" | "done",
    (v: "all" | "overdue" | "due" | "done") => void,
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

  const careStatus = (r: CareCallRow): "overdue" | "due" =>
    r.care_call_due_date && r.care_call_due_date < today ? "overdue" : "due";
  const cancelStatus = (r: CancelledRow): "overdue" | "due" | "done" =>
    isInformed(r.notes) ? "done" : r.called_at.slice(0, 10) < today ? "overdue" : "due";

  /** Classify a logged call so the Done group can honour the Type filter. */
  const callType = (c: CallLogEntry): "appt" | "care" | "cancel" | "lead" => {
    const n = c.notes ?? "";
    const tag = n.match(/^\[type:(appt|care|cancel|lead)\]/);
    if (tag) return tag[1] as "appt" | "care" | "cancel" | "lead";
    if (/care call/i.test(n)) return "care";
    if (/cancellation outcome/i.test(n) || /^\[informed:/.test(n)) return "cancel";
    if (/reminder call made|appt-tomorrow call/i.test(n)) return "appt";
    return "lead";
  };

  const doneFor = () => doneCalls.filter((c) => showType(callType(c)));

  const apptsFor = (status: "overdue" | "due" | "done") =>
    status === "due" ? tomorrowAppts.filter((a) => !calledMap[a.patient_id]) : [];
  const careFor = (status: "overdue" | "due" | "done") =>
    status === "done" ? [] : careRows.filter((r) => careStatus(r) === status);
  const cancelFor = (status: "overdue" | "due" | "done") =>
    status === "done" ? [] : cancelledRows.filter((r) => cancelStatus(r) === status);

  const body = (

    <>
      {!clinicId ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading clinic...</div>
      ) : (
        <div className="space-y-5">
          {(() => {
            const overdueCount =
              cancelledRows.filter((r) => cancelStatus(r) === "overdue").length +
              careRows.filter((r) => careStatus(r) === "overdue").length +
              leadCounts.overdue;
            const dueCount =
              tomorrowAppts.filter((a) => !calledMap[a.patient_id]).length +
              careRows.filter((r) => careStatus(r) === "due").length +
              cancelledRows.filter((r) => cancelStatus(r) === "due").length +
              leadCounts.due;
            const doneCount = doneCalls.length;
            const statusOptions: { key: "all" | "overdue" | "due" | "done"; label: string; count: number }[] = [
              { key: "all", label: "All", count: overdueCount + dueCount + doneCount },
              { key: "overdue", label: "Overdue", count: overdueCount },
              { key: "due", label: "Due today", count: dueCount },
              { key: "done", label: "Done today", count: doneCount },
            ];
            const totalTypeCount = tomorrowAppts.length + careRows.length + cancelledRows.filter((r) => !isInformed(r.notes)).length + leadTotal;
            const typeOptions: { key: "all" | "appt" | "care" | "cancel" | "lead"; label: string; count: number }[] = [
              { key: "all", label: "Type: All", count: totalTypeCount },
              { key: "appt", label: "Appointment Tomorrow", count: tomorrowAppts.length },
              { key: "care", label: "Care Call", count: careRows.length },
              { key: "cancel", label: "Cancelled Call", count: cancelledRows.filter((r) => !isInformed(r.notes)).length },
              { key: "lead", label: "Lead Call", count: leadTotal },
            ];
            const groups: ("overdue" | "due" | "done")[] =
              (statusTab as string) === "all" ? ["overdue", "due", "done"] : [statusTab as "overdue" | "due" | "done"];
            const groupMeta = {
              overdue: { label: "Overdue", cls: "text-destructive", Icon: AlertCircle },
              due: { label: "Due today", cls: "text-warning", Icon: Clock },
              done: { label: "Done today", cls: "text-success", Icon: CheckCircle2 },
            } as const;
            const groupCount = (g: "overdue" | "due" | "done") =>
              g === "done"
                ? doneCalls.length
                : (showType("appt") ? apptsFor(g).length : 0) +
                  (showType("care") ? careFor(g).length : 0) +
                  (showType("cancel") ? cancelFor(g).length : 0) +
                  (showType("lead") ? (g === "overdue" ? leadCounts.overdue : leadCounts.due) : 0);

            const anyRows = groups.some((g) => groupCount(g) > 0);

            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={statusTab as string} onValueChange={(v) => setStatusTab(v as any)}>
                    <SelectTrigger className="w-[190px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s.key} value={s.key}>{s.label} ({s.count})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                    <SelectTrigger className="w-[220px]"><SelectValue placeholder="Type: All" /></SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((t) => (
                        <SelectItem key={t.key} value={t.key}>{t.label} ({t.count})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {groups.map((g) => {
                  const meta = groupMeta[g];
                  const count = groupCount(g);
                  if ((statusTab as string) === "all" && count === 0) return null;
                  return (
                    <section key={g} className="space-y-2">
                      <div className={cn("flex items-center gap-2 px-1 pt-1 text-sm font-semibold", meta.cls)}>
                        <meta.Icon className="h-3.5 w-3.5" />
                        {meta.label} — {count}
                      </div>

                      {g === "done" ? (
                        doneCalls.length === 0 ? (
                          <p className="rounded-[10px] border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
                            No calls logged today yet
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {doneCalls.map((c) => {
                              const cleanNotes = (c.notes ?? "")
                                .replace(INFORMED_PREFIX_RE, "")
                                .replace(/^\[[^\]]+\]\s*/, "");
                              return (
                                <CallTaskRow
                                  key={c.id}
                                  icon={CheckCircle2}
                                  tone="done"
                                  patientId={c.patient?.id}
                                  name={c.patient?.name ?? "—"}
                                  meta={
                                    <>
                                      {c.outcome ? outcomeLabel(c.outcome) : "Call"} · done {format(new Date(c.called_at), "h:mm a")}
                                      {c.caller_name ? ` · by ${c.caller_name}` : ""}
                                    </>
                                  }
                                  actions={
                                    <Badge variant="outline" className="border-success/30 text-success">
                                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Done
                                    </Badge>
                                  }
                                >
                                  {cleanNotes ? <p className="text-xs text-muted-foreground">{cleanNotes}</p> : null}
                                </CallTaskRow>
                              );
                            })}
                          </ul>
                        )
                      ) : (
                        <ul className="space-y-2">
                          {showType("appt") && apptsFor(g).map((a) => (
                            <CallTaskRow
                              key={a.id}
                              icon={CalendarClock}
                              tone={g}
                              patientId={a.patient?.id}
                              name={a.patient?.name ?? "—"}
                              phone={a.patient?.phone ?? undefined}
                              meta={`Appointment tomorrow · ${a.appointment_time?.slice(0, 5) ?? ""} · ${a.doctor?.name ?? "Doctor"}`}
                              actions={
                                <>
                                  {a.patient?.phone && (
                                    <Button size="sm" variant="outline" onClick={() => sendApptReminder(a)}>
                                      <MessageCircle className="mr-1 h-3.5 w-3.5 text-success" /> WhatsApp
                                    </Button>
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm">Log call <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => markCalled(a, "confirmed")}>Confirmed</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => markCalled(a, "rescheduled")}>Rescheduled</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => markCalled(a, "cancelled")}>Cancelled</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => markCalled(a, "no_answer")}>No Answer</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </>
                              }
                            >
                              <Textarea
                                value={noteMap[a.patient_id] ?? ""}
                                onChange={(e) => setNoteForPatient(a.patient_id, e.target.value)}
                                placeholder="Add reminder note…"
                                rows={1}
                                className="min-h-[36px] text-sm"
                              />
                            </CallTaskRow>
                          ))}

                          {showType("care") && careFor(g).map((r) => {
                            const daysSince = differenceInCalendarDays(new Date(), new Date(r.appointment_date));
                            const overdueDays = r.care_call_due_date
                              ? differenceInCalendarDays(new Date(), new Date(r.care_call_due_date))
                              : 0;
                            return (
                              <CallTaskRow
                                key={r.id}
                                icon={HeartHandshake}
                                tone={g}
                                patientId={r.patient?.id}
                                name={r.patient?.name ?? "—"}
                                phone={r.patient?.phone ?? undefined}
                                meta={
                                  g === "overdue"
                                    ? `Care call · overdue ${overdueDays} day${overdueDays === 1 ? "" : "s"}`
                                    : `Care call · due today · last visit ${daysSince}d ago`
                                }
                                actions={
                                  <>
                                    {r.patient?.phone && (
                                      <Button size="sm" variant="outline" onClick={() => sendCareWhatsApp(r)}>
                                        <MessageCircle className="mr-1 h-3.5 w-3.5 text-success" /> WhatsApp
                                      </Button>
                                    )}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button size="sm">Log call <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => markCareCalled(r, "doing_well")}>Doing Well</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => markCareCalled(r, "needs_follow_up")}>Needs Follow-up</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => markCareCalled(r, "no_answer")}>No Answer</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </>
                                }
                              >
                                <Textarea
                                  value={careNotes[r.id] ?? ""}
                                  onChange={(e) => setCareNote(r.id, e.target.value)}
                                  placeholder="Add care call note…"
                                  rows={1}
                                  className="min-h-[36px] text-sm"
                                />
                              </CallTaskRow>
                            );
                          })}

                          {showType("cancel") && cancelFor(g).map((r) => {
                            const reason = parseReason(r.notes);
                            const daysAgo = differenceInCalendarDays(new Date(), new Date(r.called_at));
                            return (
                              <CallTaskRow
                                key={r.id}
                                icon={XCircle}
                                tone={g}
                                patientId={r.patient?.id}
                                name={r.patient?.name ?? "—"}
                                phone={r.patient?.phone ?? undefined}
                                meta={
                                  g === "overdue"
                                    ? `Cancelled call · overdue ${daysAgo} day${daysAgo === 1 ? "" : "s"}${reason ? ` · ${reason}` : ""}`
                                    : `Cancelled call · due today${reason ? ` · ${reason}` : ""}`
                                }
                                actions={
                                  <>
                                    {r.patient?.phone && (
                                      <Button size="sm" variant="outline" onClick={() => sendCancelWhatsApp(r)}>
                                        <MessageCircle className="mr-1 h-3.5 w-3.5 text-success" /> WhatsApp
                                      </Button>
                                    )}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button size="sm">Log call <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => markInformed(r, "rebooked")}>Rebooked</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => markInformed(r, "not_interested")}>Not Interested</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => markInformed(r, "no_answer")}>No Answer</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => markInformed(r, "informed")}>Informed</DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </>
                                }
                              >
                                <Textarea
                                  value={cancelNotes[r.id] ?? ""}
                                  onChange={(e) => setCancelNote(r.id, e.target.value)}
                                  placeholder="Add note about informing…"
                                  rows={1}
                                  className="min-h-[36px] text-sm"
                                />
                              </CallTaskRow>
                            );
                          })}

                          {showType("lead") && (
                            <CallTask
                              clinicId={clinicId}
                              onDoneClick={() => setShowDone(true)}
                              doneTodayOverride={doneCalls.length}
                              hidePills
                              flat
                              statusFilter={g}
                              onCountsChange={(c) => setLeadCounts(c)}
                            />
                          )}
                        </ul>
                      )}
                    </section>
                  );
                })}

                {!anyRows && (
                  <div className="rounded-xl border border-dashed bg-card px-7 py-8 text-center">
                    <div className="mx-auto mb-3.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-[14.5px] font-semibold">Rest of today's tasks are clear</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">Nothing due right now — check back later.</p>
                  </div>
                )}
              </>
            );
          })()}
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

