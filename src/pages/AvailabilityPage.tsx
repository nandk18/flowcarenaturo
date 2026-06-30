import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import MainShell from "@/components/layout/MainShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Plus,
} from "lucide-react";
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay,
  isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import { cn, formatDoctorName } from "@/lib/utils";
import PatientLink from "@/components/PatientLink";
import BookAppointmentModal from "@/components/appointments/BookAppointmentModal";
import CancelAppointmentModal from "@/components/appointments/CancelAppointmentModal";
import RescheduleAppointmentModal from "@/components/appointments/RescheduleAppointmentModal";
import {
  DoctorSchedule, DoctorException, ExistingAppointment,
  generateSlots, getDaySummary, getDayOfWeek, DaySummary,
} from "@/lib/scheduleSlots";

type Doctor = { id: string; name: string };
type Appt = {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id?: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string | null;
  patient: { id: string; name: string; phone: string | null } | null;
  services?: string[];
};
type View = "day" | "week" | "month";

const statusDot: Record<string, string> = {
  scheduled: "bg-info",
  confirmed: "bg-primary",
  completed: "bg-success",
  cancelled: "bg-destructive",
};

const summaryTint: Record<DaySummary, string> = {
  off: "bg-muted/40",
  past: "bg-background",
  available: "bg-success/10",
  partial: "bg-warning/10",
  full: "bg-destructive/10",
};

const summaryLabel: Record<DaySummary, string> = {
  off: "Off",
  past: "",
  available: "Available",
  partial: "Partial",
  full: "Full",
};

export default function AvailabilityPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const presetPatientId = searchParams.get("patient") ?? undefined;
  const shouldAutoOpen = searchParams.get("book") === "1" || !!presetPatientId;

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const urlDoctor = searchParams.get("doctor") ?? "";
  const urlView = (searchParams.get("view") as View) || "month";
  const urlDate = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");
  const [doctorId, setDoctorIdState] = useState(urlDoctor);
  const [view, setViewState] = useState<View>(urlView);
  const [cursor, setCursorState] = useState<Date>(() => {
    const parsed = new Date(urlDate);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  });
  const [appts, setAppts] = useState<Appt[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [exceptions, setExceptions] = useState<DoctorException[]>([]);

  const updateParam = useCallback((key: string, value: string, def: string) => {
    setSearchParams((prev) => {
      if (!value || value === def) prev.delete(key);
      else prev.set(key, value);
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const setDoctorId = (id: string) => { setDoctorIdState(id); updateParam("doctor", id, ""); };
  const setView = (v: View) => { setViewState(v); updateParam("view", v, "month"); };
  const setCursor = (updater: Date | ((c: Date) => Date)) => {
    setCursorState((prev) => {
      const next = typeof updater === "function" ? (updater as any)(prev) : updater;
      updateParam("date", format(next, "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd"));
      return next;
    });
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInit, setModalInit] = useState<{ date?: string; time?: string; patientId?: string; lockPatient?: boolean } | null>(null);
  const [cancelAppt, setCancelAppt] = useState<Appt | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<Appt | null>(null);
  const [detailAppt, setDetailAppt] = useState<Appt | null>(null);

  useEffect(() => {
    if (shouldAutoOpen) {
      setModalInit({ patientId: presetPatientId, lockPatient: !!presetPatientId });
      setModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "day") return { rangeStart: cursor, rangeEnd: cursor };
    if (view === "week") return {
      rangeStart: startOfWeek(cursor, { weekStartsOn: 1 }),
      rangeEnd: endOfWeek(cursor, { weekStartsOn: 1 }),
    };
    return {
      rangeStart: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
      rangeEnd: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
    };
  }, [view, cursor]);

  useEffect(() => {
    if (!profile?.clinic_id) return;
    supabase.from("doctors").select("id, name").eq("clinic_id", profile.clinic_id).order("name")
      .then(({ data }) => {
        const list = (data ?? []) as Doctor[];
        setDoctors(list);
        if (!doctorId && list[0]) setDoctorId(list[0].id);
      });
  }, [profile?.clinic_id]);

  // Load schedule (full week) for this doctor — cheap, one row per day
  useEffect(() => {
    if (!doctorId) { setSchedules([]); return; }
    (supabase as any)
      .from("doctor_schedules")
      .select("*")
      .eq("doctor_id", doctorId)
      .then(({ data }: any) => setSchedules((data ?? []) as DoctorSchedule[]));
  }, [doctorId]);

  const fetchAppts = useCallback(async () => {
    if (!profile?.clinic_id || !doctorId) { setAppts([]); setExceptions([]); return; }
    const startStr = format(rangeStart, "yyyy-MM-dd");
    const endStr = format(rangeEnd, "yyyy-MM-dd");
    const [aRes, eRes] = await Promise.all([
      (supabase as any).from("appointments")
        .select("id, clinic_id, patient_id, doctor_id, appointment_date, appointment_time, status, reason, patients(id, name, phone), appointment_services(invoice_services(name))")
        .eq("clinic_id", profile.clinic_id)
        .eq("doctor_id", doctorId)
        .gte("appointment_date", startStr)
        .lte("appointment_date", endStr)
        .order("appointment_time"),
      (supabase as any).from("doctor_exceptions")
        .select("*")
        .eq("doctor_id", doctorId)
        .gte("exception_date", startStr)
        .lte("exception_date", endStr),
    ]);
    setAppts((aRes.data ?? []).map((a: any) => ({
      ...a,
      patient: Array.isArray(a.patients) ? a.patients[0] : a.patients,
      services: (a.appointment_services ?? [])
        .map((s: any) => s.invoice_services?.name)
        .filter(Boolean) as string[],
    })));
    setExceptions((eRes.data ?? []) as DoctorException[]);
  }, [profile?.clinic_id, doctorId, rangeStart, rangeEnd]);

  useEffect(() => { fetchAppts(); }, [fetchAppts]);

  useEffect(() => {
    if (!profile?.clinic_id) return;
    const ch = supabase.channel("availability-appts")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `clinic_id=eq.${profile.clinic_id}` }, () => fetchAppts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.clinic_id, fetchAppts]);

  const apptsByDate = useMemo(() => {
    const m = new Map<string, Appt[]>();
    for (const a of appts) {
      const k = a.appointment_date;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  }, [appts]);

  const exceptionByDate = useMemo(() => {
    const m = new Map<string, DoctorException>();
    for (const e of exceptions) m.set(e.exception_date, e);
    return m;
  }, [exceptions]);

  const scheduleByDow = useMemo(() => {
    const m = new Map<number, DoctorSchedule>();
    for (const s of schedules) m.set(s.day_of_week, s);
    return m;
  }, [schedules]);

  const summaryFor = useCallback((date: Date): DaySummary => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dow = getDayOfWeek(dateStr);
    return getDaySummary({
      schedule: scheduleByDow.get(dow) ?? null,
      exception: exceptionByDate.get(dateStr) ?? null,
      appointments: (apptsByDate.get(dateStr) ?? []) as ExistingAppointment[],
      date: dateStr,
    });
  }, [scheduleByDow, exceptionByDate, apptsByDate]);

  const goPrev = () => setCursor((c) => view === "day" ? addDays(c, -1) : view === "week" ? addWeeks(c, -1) : addMonths(c, -1));
  const goNext = () => setCursor((c) => view === "day" ? addDays(c, 1) : view === "week" ? addWeeks(c, 1) : addMonths(c, 1));
  const goToday = () => setCursor(new Date());

  const openBook = (date?: string, time?: string) => {
    setModalInit({ date, time });
    setModalOpen(true);
  };

  const headerLabel = view === "day"
    ? format(cursor, "EEEE, MMM d, yyyy")
    : view === "week"
      ? `${format(startOfWeek(cursor, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(cursor, { weekStartsOn: 1 }), "MMM d, yyyy")}`
      : format(cursor, "MMMM yyyy");

  return (
    <MainShell title="Availability">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Availability</h1>
        <Button onClick={() => openBook()}>
          <Plus className="mr-1 h-4 w-4" /> Book Appointment
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Doctor</Label>
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select doctor" /></SelectTrigger>
            <SelectContent>
              {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{formatDoctorName(d.name)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
        <div className="flex rounded-md border">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("px-3 py-1.5 text-xs capitalize", view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{v}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[200px] text-center font-display text-sm font-semibold">{headerLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Color legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-success/50" /> Available</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-warning/50" /> Partial</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-destructive/50" /> Full</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-muted" /> Off</span>
      </div>

      {view === "month" && (
        <MonthView cursor={cursor} apptsByDate={apptsByDate} summaryFor={summaryFor} onPickDay={(d) => { setCursor(d); setView("day"); }} />
      )}
      {view === "week" && (
        <WeekView cursor={cursor} apptsByDate={apptsByDate} summaryFor={summaryFor} onPickSlot={(d, t) => openBook(d, t)} />
      )}
      {view === "day" && (
        <DayView
          date={cursor}
          schedule={scheduleByDow.get(getDayOfWeek(format(cursor, "yyyy-MM-dd"))) ?? null}
          exception={exceptionByDate.get(format(cursor, "yyyy-MM-dd")) ?? null}
          appts={apptsByDate.get(format(cursor, "yyyy-MM-dd")) ?? []}
          onPickSlot={(d, t) => openBook(d, t)}
          onCancelAppt={(a) => setCancelAppt(a)}
          onReschedule={(a) => setRescheduleAppt(a)}
          onOpenAppt={(a) => setDetailAppt(a)}
        />
      )}

      <RescheduleAppointmentModal
        open={!!rescheduleAppt}
        onClose={() => setRescheduleAppt(null)}
        appointment={rescheduleAppt ? {
          id: rescheduleAppt.id,
          clinic_id: rescheduleAppt.clinic_id,
          patient_id: rescheduleAppt.patient_id,
          doctor_id: rescheduleAppt.doctor_id ?? null,
          appointment_date: rescheduleAppt.appointment_date,
          appointment_time: rescheduleAppt.appointment_time,
          patient_name: rescheduleAppt.patient?.name ?? "Patient",
          reason: rescheduleAppt.reason,
        } : null}
        onRescheduled={() => { setRescheduleAppt(null); fetchAppts(); }}
      />

      <CancelAppointmentModal
        open={!!cancelAppt}
        onClose={() => setCancelAppt(null)}
        appointment={cancelAppt ? {
          id: cancelAppt.id,
          clinic_id: cancelAppt.clinic_id,
          patient_id: cancelAppt.patient_id,
          appointment_date: cancelAppt.appointment_date,
          appointment_time: cancelAppt.appointment_time,
          patient_name: cancelAppt.patient?.name ?? "Patient",
          patient_phone: cancelAppt.patient?.phone ?? null,
        } : null}
        onCancelled={() => { setCancelAppt(null); fetchAppts(); }}
      />

      <BookAppointmentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          if (searchParams.get("patient") || searchParams.get("book")) {
            searchParams.delete("patient");
            searchParams.delete("book");
            setSearchParams(searchParams, { replace: true });
          }
        }}
        onBooked={fetchAppts}
        initialDoctorId={doctorId || undefined}
        initialDate={modalInit?.date}
        initialTime={modalInit?.time}
        initialPatientId={modalInit?.patientId}
        lockPatient={modalInit?.lockPatient}
      />

      {/* Cancelled / appt detail dialog */}
      {detailAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailAppt(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold">Appointment</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {detailAppt.patient?.name} · {detailAppt.appointment_date} {detailAppt.appointment_time?.slice(0, 5)}
            </p>
            {detailAppt.services && detailAppt.services.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Services: {detailAppt.services.join(", ")}</p>
            )}
            {detailAppt.reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {detailAppt.reason}</p>}
            <p className="mt-1 text-xs uppercase tracking-wide text-red-700">Status: {detailAppt.status}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDetailAppt(null)}>Close</Button>
              <Button
                size="sm"
                onClick={() => {
                  const a = detailAppt;
                  setDetailAppt(null);
                  setModalInit({ patientId: a.patient_id, lockPatient: false });
                  setModalOpen(true);
                }}
              >
                Reschedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainShell>
  );
}

function MonthView({
  cursor, apptsByDate, summaryFor, onPickDay,
}: { cursor: Date; apptsByDate: Map<string, any[]>; summaryFor: (d: Date) => DaySummary; onPickDay: (d: Date) => void }) {
  const cells = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);
  return (
    <Card className="shadow-card"><CardContent className="p-3">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const items = apptsByDate.get(dateStr) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const today = isSameDay(day, new Date());
          const summary = summaryFor(day);
          return (
            <button
              key={dateStr}
              onClick={() => onPickDay(day)}
              className={cn(
                "min-h-[96px] rounded-md border p-1 text-left text-xs flex flex-col gap-1",
                summaryTint[summary],
                !inMonth && "opacity-40",
                today && "ring-2 ring-primary",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{format(day, "d")}</span>
                {summaryLabel[summary] && (
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{summaryLabel[summary]}</span>
                )}
              </div>
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {items.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center gap-1 truncate rounded bg-background/70 px-1 py-0.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot[a.status] ?? "bg-muted-foreground")} />
                    <span className="font-mono">{a.appointment_time?.substring(0, 5)}</span>
                    <span className="truncate">
                      {a.patient?.name ?? "—"}
                      {a.services && a.services.length > 0 && (
                        <span className="text-muted-foreground"> · {a.services.slice(0, 2).join(", ")}</span>
                      )}
                    </span>
                  </div>
                ))}
                {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3} more</div>}
              </div>
            </button>
          );
        })}
      </div>
    </CardContent></Card>
  );
}

function WeekView({
  cursor, apptsByDate, summaryFor, onPickSlot,
}: { cursor: Date; apptsByDate: Map<string, Appt[]>; summaryFor: (d: Date) => DaySummary; onPickSlot: (date: string, time: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor, { weekStartsOn: 1 }), i));
  return (
    <Card className="shadow-card"><CardContent className="p-3">
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const items = apptsByDate.get(dateStr) ?? [];
          const today = isSameDay(day, new Date());
          const summary = summaryFor(day);
          return (
            <div key={dateStr} className={cn("rounded-md border p-2", summaryTint[summary], today && "ring-2 ring-primary")}>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span>{format(day, "EEE d")}</span>
                {summaryLabel[summary] && (
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{summaryLabel[summary]}</span>
                )}
              </div>
              <div className="space-y-1">
                {items.length === 0 && summary !== "off" && (
                  <button onClick={() => onPickSlot(dateStr, "")} className="w-full rounded border border-dashed py-2 text-[10px] text-muted-foreground hover:bg-muted">+ Book</button>
                )}
                {items.map((a) => (
                  <div key={a.id} className="rounded border bg-background p-1.5 text-[11px]">
                    <div className="flex items-center gap-1">
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusDot[a.status] ?? "bg-muted-foreground")} />
                      <span className="font-mono">{a.appointment_time?.substring(0, 5)}</span>
                    </div>
                    {a.patient && <PatientLink patientId={a.patient.id} className="block truncate text-xs">{a.patient.name}</PatientLink>}
                    {a.services && a.services.length > 0 && (
                      <div className="truncate text-[10px] text-muted-foreground">
                        {a.services.slice(0, 2).join(", ")}{a.services.length > 2 ? ` +${a.services.length - 2}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </CardContent></Card>
  );
}

function DayView({
  date, schedule, exception, appts, onPickSlot, onCancelAppt, onReschedule, onOpenAppt,
}: {
  date: Date;
  schedule: DoctorSchedule | null;
  exception: DoctorException | null;
  appts: Appt[];
  onPickSlot: (date: string, time: string) => void;
  onCancelAppt: (a: Appt) => void;
  onReschedule: (a: Appt) => void;
  onOpenAppt: (a: Appt) => void;
}) {
  const dateStr = format(date, "yyyy-MM-dd");
  // Cancelled appointments free up the slot — exclude from generator + booked map
  const activeAppts = appts.filter((a) => a.status !== "cancelled");
  const cancelledAppts = appts.filter((a) => a.status === "cancelled");
  const { slots, reason } = generateSlots({
    schedule,
    exception,
    appointments: activeAppts as unknown as ExistingAppointment[],
    date: dateStr,
  });

  // Map slot -> active existing appt for full appointment metadata
  const byTime = new Map<string, Appt>();
  for (const a of activeAppts) byTime.set(a.appointment_time?.substring(0, 5), a);

  if (reason === "past") {
    return <Card className="shadow-card"><CardContent className="py-10 text-center text-sm text-muted-foreground">This date is in the past.</CardContent></Card>;
  }
  if (reason === "exception") {
    return (
      <Card className="shadow-card"><CardContent className="py-10 text-center text-sm">
        <div className="font-semibold capitalize">{exception?.type ?? "Exception"}</div>
        <div className="text-muted-foreground">{exception?.reason || "Doctor not available on this date."}</div>
      </CardContent></Card>
    );
  }
  if (reason === "no-schedule" || reason === "inactive") {
    return <Card className="shadow-card"><CardContent className="py-10 text-center text-sm text-muted-foreground">Doctor is not scheduled on this day.</CardContent></Card>;
  }

  return (
    <Card className="shadow-card"><CardContent className="p-3">
      <div className="space-y-1">
        {slots.map((s) => {
          const a = byTime.get(s.time);
          if (a) {
            return (
              <div
                key={s.time}
                className="flex w-full flex-wrap items-center gap-3 rounded border border-primary/30 bg-primary/5 px-3 py-2 text-left text-sm"
              >
                <span className="w-16 font-mono text-xs text-primary">{s.time}</span>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", statusDot[a.status] ?? "bg-muted-foreground")} />
                  {a.patient && <PatientLink patientId={a.patient.id}>{a.patient.name}</PatientLink>}
                  {a.services && a.services.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      · {a.services.slice(0, 2).join(", ")}{a.services.length > 2 ? ` +${a.services.length - 2}` : ""}
                    </span>
                  )}
                  {a.reason && <span className="text-xs text-muted-foreground">— {a.reason}</span>}
                  <span className="ml-auto text-[10px] uppercase text-muted-foreground">{a.status}</span>
                  {a.status !== "completed" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px]"
                        onClick={() => onReschedule(a)}
                      >
                        Reschedule
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px] text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => onCancelAppt(a)}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          }
          return (
            <button
              key={s.time}
              onClick={() => !s.past && onPickSlot(dateStr, s.time)}
              disabled={s.past}
              className={cn(
                "flex w-full items-center gap-3 rounded border px-3 py-2 text-left text-sm",
                s.past ? "opacity-50" : "border-dashed hover:bg-muted",
              )}
            >
              <span className="w-16 font-mono text-xs text-primary">{s.time}</span>
              <span className="text-xs text-muted-foreground">{s.past ? "Past" : "Available — click to book"}</span>
            </button>
          );
        })}
        {slots.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">No slots available for this day.</div>
        )}
        {cancelledAppts.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <div className="mb-1 text-[10px] font-semibold uppercase text-red-700">Cancelled</div>
            {cancelledAppts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpenAppt(a)}
                className="flex w-full items-center gap-3 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-left text-sm hover:bg-red-100"
              >
                <span className="w-16 font-mono text-xs text-red-700">{a.appointment_time?.slice(0, 5)}</span>
                {a.patient && (
                  <span className="text-red-700 line-through">{a.patient.name}</span>
                )}
                {a.services && a.services.length > 0 && (
                  <span className="text-xs text-red-700/70">· {a.services.slice(0, 2).join(", ")}</span>
                )}
                <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">Cancelled</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </CardContent></Card>
  );
}
