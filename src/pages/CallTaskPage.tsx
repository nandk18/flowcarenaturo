import { useEffect, useState, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { CallTask } from "./Sales";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PatientLink from "@/components/PatientLink";
import { MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { formStorage } from "@/hooks/usePersistedForm";
import { getProfileId } from "@/utils/getProfileId";
import { buildMessage } from "@/lib/messageTemplates";
import { openWhatsApp } from "@/lib/whatsapp";

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

export default function CallTaskPage() {
  const { profile } = useAuth();
  const { clinic } = useClinic();
  const clinicId = profile?.clinic_id;
  const clinicName = clinic?.name ?? "our clinic";
  const [tomorrowAppts, setTomorrowAppts] = useState<TomorrowAppt[]>([]);
  const [calledMap, setCalledMap] = useState<Record<string, boolean>>({});
  const [doneCalls, setDoneCalls] = useState<CallLogEntry[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

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

  const loadAll = useCallback(async () => {
    if (!clinicId) return;
    const [apptsRes, callsRes] = await Promise.all([
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
    ]);

    const appts = (apptsRes.data ?? []).map((x: any) => ({
      ...x,
      patient: Array.isArray(x.patients) ? x.patients[0] : x.patients,
      doctor: Array.isArray(x.doctors) ? x.doctors[0] : x.doctors,
    })) as TomorrowAppt[];
    setTomorrowAppts(appts);
    // Restore any draft notes from prior session, keyed by patient_id.
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
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      calls.forEach((c) => { c.caller_name = c.called_by ? map.get(c.called_by) ?? null : null; });
    }
    setDoneCalls(calls);

    // Mark "called" rows for tomorrow patients we've already logged today
    const apptPidSet = new Set(appts.map((a) => a.patient_id));
    const called: Record<string, boolean> = {};
    calls.forEach((c) => { if (apptPidSet.has(c.patient_id)) called[c.patient_id] = true; });
    setCalledMap(called);
  }, [clinicId, tomorrow, today]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const markCalled = async (a: TomorrowAppt) => {
    if (!clinicId) return;
    const userId = await getProfileId();
    const typed = noteMap[a.patient_id]?.trim();
    const defaultNote = `Reminder call made for appointment on ${a.appointment_time ? format(addDays(new Date(), 1), "dd MMM yyyy") + " at " + a.appointment_time.slice(0, 5) : format(addDays(new Date(), 1), "dd MMM yyyy")} with ${a.doctor?.name ?? "doctor"}`;
    const note = typed && typed.length > 0 ? typed : defaultNote;

    const { error } = await supabase.from("call_logs").insert({
      patient_id: a.patient_id,
      clinic_id: clinicId,
      outcome: "follow_up",
      notes: note,
      called_by: userId,
      called_at: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("contact_notes").insert({
      patient_id: a.patient_id, clinic_id: clinicId, note, created_by: userId,
    });
    setCalledMap((m) => ({ ...m, [a.patient_id]: true }));
    setNoteMap((m) => { const n = { ...m }; delete n[a.patient_id]; return n; });
    formStorage.clear(`call_note_${a.patient_id}`);
    toast.success("Call logged to contact notes");
    loadAll();
  };

  return (
    <DashboardLayout title="Call Task">
      {!clinicId ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading clinic...</div>
      ) : (
        <div className="space-y-5">
          {tomorrowAppts.length > 0 && (
            <section className="rounded-2xl border bg-card shadow-card overflow-hidden">
              <header className="flex items-center justify-between border-b bg-blue-50 px-4 py-3">
                <h2 className="font-display text-sm font-semibold text-blue-900">
                  Appointment Tomorrow
                  <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">{tomorrowAppts.length}</span>
                </h2>
                <span className="text-xs text-blue-700">Confirm tomorrow's bookings</span>
              </header>
              <ul className="divide-y">
                {tomorrowAppts.map((a) => {
                  const called = calledMap[a.patient_id];
                  return (
                    <li key={a.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Appt Tomorrow</Badge>
                        {a.patient && (
                          <PatientLink patientId={a.patient.id} className="text-sm font-semibold">{a.patient.name}</PatientLink>
                        )}
                        <span className="text-xs text-muted-foreground">{a.appointment_time?.slice(0, 5)}</span>
                        <span className="text-xs text-muted-foreground">· {a.doctor?.name ?? "Doctor"}</span>
                        {a.patient?.phone && (
                          <>
                            <span className="text-xs text-muted-foreground">· {a.patient.phone}</span>
                            <a
                              href={`https://wa.me/${a.patient.phone.replace(/[^\d]/g, "")}`}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center text-green-600 text-xs hover:underline"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </a>
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
                        <Button
                          size="sm"
                          variant={called ? "outline" : "default"}
                          disabled={called}
                          onClick={() => markCalled(a)}
                          className={cn(called && "text-green-700 border-green-300")}
                        >
                          {called ? <><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Called</> : "Mark Called"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <CallTask
            clinicId={clinicId}
            onDoneClick={() => setShowDone(true)}
            doneTodayOverride={doneCalls.length}
          />
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
    </DashboardLayout>
  );
}

function outcomeStyle(o: string) {
  switch (o) {
    case "no_answer": return "bg-gray-100 text-gray-700 border-gray-200";
    case "follow_up": return "bg-blue-100 text-blue-700 border-blue-200";
    case "not_interested": return "bg-red-100 text-red-700 border-red-200";
    case "booked": return "bg-green-100 text-green-700 border-green-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
}
function outcomeLabel(o: string) {
  return ({ no_answer: "No Answer", follow_up: "Follow Up", not_interested: "Not Interested", booked: "Booked" } as any)[o] ?? o;
}
