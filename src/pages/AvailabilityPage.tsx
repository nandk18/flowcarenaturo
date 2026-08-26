import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import MainShell from "@/components/layout/MainShell";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Plus, MessageCircle,
} from "lucide-react";
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay,
  isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import { cn, formatDoctorName } from "@/lib/utils";
import { buildMessage } from "@/lib/messageTemplates";
import { openWhatsApp } from "@/lib/whatsapp";
import WhatsAppStatus from "@/components/appointments/WhatsAppStatus";

import PatientLink from "@/components/PatientLink";
import BookAppointmentModal from "@/components/appointments/BookAppointmentModal";
import CancelAppointmentModal from "@/components/appointments/CancelAppointmentModal";
import RescheduleAppointmentModal from "@/components/appointments/RescheduleAppointmentModal";
import DoctorMultiSelect from "@/components/calendar/DoctorMultiSelect";
import { doctorColor, doctorInitial } from "@/components/calendar/doctorColors";
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
  doctor?: { name: string } | null;
  services?: string[];
};
type View = "day" | "week" | "month";
type ApptType = "consultation" | "treatment" | "break";

const statusDot: Record<string, string> = {
  scheduled: "bg-info",
  confirmed: "bg-primary",
  in_progress: "bg-teal-500",
  completed: "bg-success",
  cancelled: "bg-muted-foreground",
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

function apptType(a: { reason: string | null; services?: string[] }): ApptType {
  const r = (a.reason || "").toLowerCase();
  if (r.includes("lunch") || r.includes("break")) return "break";
  if (a.services && a.services.length > 0) return "treatment";
  return "consultation";
}

const typeStyle: Record<ApptType, { border: string; bg: string; text: string; dot: string; label: string }> = {
  consultation: { border: "border-info", bg: "bg-info/10", text: "text-info", dot: "bg-info", label: "Consultation" },
  treatment: { border: "border-teal-500", bg: "bg-teal-500/10", text: "text-teal-700", dot: "bg-teal-500", label: "Treatment" },
  break: { border: "border-muted-foreground/40", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Break" },
};

const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
};

export default function AvailabilityPage() {
  const { profile } = useAuth();
  const { clinic } = useClinic();
  const [searchParams, setSearchParams] = useSearchParams();
  const presetPatientId = searchParams.get("patient") ?? undefined;
  const shouldAutoOpen = searchParams.get("book") === "1" || !!presetPatientId;

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const urlDoctor = searchParams.get("doctor") ?? "";
  const urlView = (searchParams.get("view") as View) || "month";
  const urlDate = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");
  const [doctorIds, setDoctorIdsState] = useState<string[]>(urlDoctor ? urlDoctor.split(",").filter(Boolean) : []);
  const [view, setViewState] = useState<View>(urlView);
  const [cursor, setCursorState] = useState<Date>(() => {
    const parsed = new Date(urlDate);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  });
  const [appts, setAppts] = useState<Appt[]>([]);
  const [schedulesByDoctor, setSchedulesByDoctor] = useState<Map<string, DoctorSchedule[]>>(new Map());
  const [exceptionsByDoctor, setExceptionsByDoctor] = useState<Map<string, DoctorException[]>>(new Map());

  const updateParam = useCallback((key: string, value: string, def: string) => {
    setSearchParams((prev) => {
      if (!value || value === def) prev.delete(key);
      else prev.set(key, value);
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const setDoctorIds = (ids: string[]) => {
    setDoctorIdsState(ids);
    const allIds = doctors.map((d) => d.id);
    const isAll = allIds.length > 0 && ids.length === allIds.length;
    updateParam("doctor", ids.join(","), isAll ? allIds.join(",") : "__never__");
    if (isAll) updateParam("doctor", "", "");
  };
  const setView = (v: View) => { setViewState(v); updateParam("view", v, "month"); };
  const setCursor = (updater: Date | ((c: Date) => Date)) => {
    setCursorState((prev) => {
      const next = typeof updater === "function" ? (updater as any)(prev) : updater;
      updateParam("date", format(next, "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd"));
      return next;
    });
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInit, setModalInit] = useState<{ date?: string; time?: string; patientId?: string; lockPatient?: boolean; doctorId?: string } | null>(null);
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
        setDoctorIdsState((prev) => (prev.length === 0 && list.length ? list.map((d) => d.id) : prev));
      });
  }, [profile?.clinic_id]);

  // Load schedules (full week) for the selected doctors — cheap, one row per day per doctor
  useEffect(() => {
    if (doctorIds.length === 0) { setSchedulesByDoctor(new Map()); return; }
    (supabase as any)
      .from("doctor_schedules")
      .select("*")
      .in("doctor_id", doctorIds)
      .then(({ data }: any) => {
        const m = new Map<string, DoctorSchedule[]>();
        for (const s of (data ?? []) as DoctorSchedule[]) {
          if (!m.has(s.doctor_id)) m.set(s.doctor_id, []);
          m.get(s.doctor_id)!.push(s);
        }
        setSchedulesByDoctor(m);
      });
  }, [doctorIds.join(",")]);

  const fetchAppts = useCallback(async () => {
    if (!profile?.clinic_id || doctorIds.length === 0) { setAppts([]); setExceptionsByDoctor(new Map()); return; }
    const startStr = format(rangeStart, "yyyy-MM-dd");
    const endStr = format(rangeEnd, "yyyy-MM-dd");
    const [aRes, eRes] = await Promise.all([
      (supabase as any).from("appointments")
        .select("id, clinic_id, patient_id, doctor_id, appointment_date, appointment_time, status, reason, patients(id, name, phone), doctors(id, name), appointment_services(invoice_services(name))")
        .eq("clinic_id", profile.clinic_id)
        .in("doctor_id", doctorIds)
        .gte("appointment_date", startStr)
        .lte("appointment_date", endStr)
        .order("appointment_time"),
      (supabase as any).from("doctor_exceptions")
        .select("*")
        .in("doctor_id", doctorIds)
        .gte("exception_date", startStr)
        .lte("exception_date", endStr),
    ]);
    setAppts((aRes.data ?? []).map((a: any) => ({
      ...a,
      patient: Array.isArray(a.patients) ? a.patients[0] : a.patients,
      doctor: Array.isArray(a.doctors) ? a.doctors[0] : a.doctors,
      services: (a.appointment_services ?? [])
        .map((s: any) => s.invoice_services?.name)
        .filter(Boolean) as string[],
    })));
    const em = new Map<string, DoctorException[]>();
    for (const e of (eRes.data ?? []) as DoctorException[]) {
      if (!em.has(e.doctor_id)) em.set(e.doctor_id, []);
      em.get(e.doctor_id)!.push(e);
    }
    setExceptionsByDoctor(em);
  }, [profile?.clinic_id, doctorIds.join(","), rangeStart, rangeEnd]);

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

  const apptsByDoctorDate = useMemo(() => {
    const m = new Map<string, Map<string, Appt[]>>();
    for (const a of appts) {
      if (!a.doctor_id) continue;
      if (!m.has(a.doctor_id)) m.set(a.doctor_id, new Map());
      const inner = m.get(a.doctor_id)!;
      if (!inner.has(a.appointment_date)) inner.set(a.appointment_date, []);
      inner.get(a.appointment_date)!.push(a);
    }
    return m;
  }, [appts]);

  const exceptionByDate = useMemo(() => {
    const m = new Map<string, DoctorException>();
    const primary = doctorIds[0];
    for (const e of exceptionsByDoctor.get(primary) ?? []) m.set(e.exception_date, e);
    return m;
  }, [exceptionsByDoctor, doctorIds]);

  const scheduleByDow = useMemo(() => {
    const m = new Map<number, DoctorSchedule>();
    const primary = doctorIds[0];
    for (const s of schedulesByDoctor.get(primary) ?? []) m.set(s.day_of_week, s);
    return m;
  }, [schedulesByDoctor, doctorIds]);

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

  const openBook = (date?: string, time?: string, doctorId?: string) => {
    setModalInit({ date, time, doctorId });
    setModalOpen(true);
  };

  const headerLabel = view === "day"
    ? format(cursor, "EEEE, MMM d, yyyy")
    : view === "week"
      ? `${format(startOfWeek(cursor, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(cursor, { weekStartsOn: 1 }), "MMM d, yyyy")}`
      : format(cursor, "MMMM yyyy");

  const allDoctorIds = doctors.map((d) => d.id);
  const selectedDoctors = doctors.filter((d) => doctorIds.includes(d.id));

  return (
    <MainShell title="Availability">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-muted-foreground">Appointments across the clinic</p>
        </div>
        <Button onClick={() => openBook(undefined, undefined, doctorIds[0])}>
          <Plus className="mr-1 h-4 w-4" /> Book Appointment
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <DoctorMultiSelect doctors={doctors} selectedIds={doctorIds} onChange={setDoctorIds} />

        <div className="inline-flex rounded-lg border bg-muted/40 p-1">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
                view === v ? "bg-card text-foreground shadow-sm border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[200px] text-center font-display text-sm font-semibold">{headerLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {view === "day" ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {selectedDoctors.map((d) => {
            const color = doctorColor(allDoctorIds, d.id);
            return (
              <span key={d.id} className="flex items-center gap-1">
                <span className={cn("h-2.5 w-2.5 rounded-full", color.dot)} /> {formatDoctorName(d.name)}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className={cn("h-2.5 w-2.5 rounded", typeStyle.consultation.dot)} /> Consultation</span>
          <span className="flex items-center gap-1"><span className={cn("h-2.5 w-2.5 rounded", typeStyle.treatment.dot)} /> Treatment</span>
          <span className="flex items-center gap-1"><span className={cn("h-2.5 w-2.5 rounded", typeStyle.break.dot)} /> Break</span>
        </div>
      )}

      {view === "month" && (
        <MonthView cursor={cursor} apptsByDate={apptsByDate} summaryFor={summaryFor} onPickDay={(d) => { setCursor(d); setView("day"); }} />
      )}
      {view === "week" && (
        <WeekView cursor={cursor} apptsByDate={apptsByDate} summaryFor={summaryFor} onPickSlot={(d, t) => openBook(d, t, doctorIds[0])} onOpenAppt={(a) => setDetailAppt(a)} />
      )}
      {view === "day" && (
        <MultiDoctorDayView
          date={cursor}
          doctors={selectedDoctors}
          allDoctorIds={allDoctorIds}
          schedulesByDoctor={schedulesByDoctor}
          exceptionsByDoctor={exceptionsByDoctor}
          apptsByDoctorDate={apptsByDoctorDate}
          onPickSlot={(doctorId, d, t) => openBook(d, t, doctorId)}
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
        initialDoctorId={modalInit?.doctorId || doctorIds[0] || undefined}
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
            {detailAppt.doctor?.name && (
              <p className="mt-1 text-xs text-muted-foreground">Doctor: {formatDoctorName(detailAppt.doctor.name)}</p>
            )}
            {detailAppt.services && detailAppt.services.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Services: {detailAppt.services.join(", ")}</p>
            )}
            {detailAppt.reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {detailAppt.reason}</p>}
            <p className="mt-1 text-xs uppercase tracking-wide text-red-700">Status: {detailAppt.status}</p>
            <WhatsAppStatus appointmentId={detailAppt.id} />

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDetailAppt(null)}>Close</Button>
              {detailAppt.patient?.phone && detailAppt.status !== "cancelled" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  onClick={async () => {
                    const msg = await buildMessage(detailAppt.clinic_id, "appointment_reminder", {
                      patient_name: detailAppt.patient?.name ?? "",
                      clinic_name: clinic?.name ?? "our clinic",
                      appointment_date: detailAppt.appointment_date,
                      appointment_time: detailAppt.appointment_time?.slice(0, 5) ?? "",
                      doctor_name: formatDoctorName(detailAppt.doctor?.name) ?? "",
                    });
                    openWhatsApp(detailAppt.patient!.phone!, msg);
                  }}
                >
                  <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  const a = detailAppt;
                  setDetailAppt(null);
                  setRescheduleAppt(a);
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
                {items.slice(0, 3).map((a) => {
                  const t = typeStyle[apptType(a)];
                  return (
                    <div key={a.id} className={cn("flex items-center gap-1 truncate rounded border-l-2 bg-background/70 px-1 py-0.5", t.border, a.status === "cancelled" && "opacity-60")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
                      <span className="font-mono">{a.appointment_time?.substring(0, 5)}</span>
                      <span className={cn("truncate", a.status === "cancelled" && "line-through text-muted-foreground")}>
                        {a.patient?.name ?? "—"}
                      </span>
                    </div>
                  );
                })}
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
  cursor, apptsByDate, summaryFor, onPickSlot, onOpenAppt,
}: { cursor: Date; apptsByDate: Map<string, Appt[]>; summaryFor: (d: Date) => DaySummary; onPickSlot: (date: string, time: string) => void; onOpenAppt: (a: Appt) => void }) {
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
                {items.map((a) => {
                  const t = typeStyle[apptType(a)];
                  return (
                    <div key={a.id} onClick={() => onOpenAppt(a)} className={cn("cursor-pointer rounded border-l-2 bg-background p-1.5 text-[11px]", t.border, a.status === "cancelled" && "opacity-60")}>
                      <div className="flex items-center gap-1">
                        <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
                        <span className="font-mono">{a.appointment_time?.substring(0, 5)}</span>
                      </div>
                      {a.patient && <span className={cn("block truncate text-xs", a.status === "cancelled" && "line-through text-muted-foreground")}>{a.patient.name}</span>}
                      {a.services && a.services.length > 0 && (
                        <div className={cn("truncate text-[10px] text-muted-foreground", a.status === "cancelled" && "line-through")}>
                          {a.services.slice(0, 2).join(", ")}{a.services.length > 2 ? ` +${a.services.length - 2}` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}

              </div>
            </div>
          );
        })}
      </div>
    </CardContent></Card>
  );
}

function MultiDoctorDayView({
  date, doctors, allDoctorIds, schedulesByDoctor, exceptionsByDoctor, apptsByDoctorDate,
  onPickSlot, onCancelAppt, onReschedule, onOpenAppt,
}: {
  date: Date;
  doctors: Doctor[];
  allDoctorIds: string[];
  schedulesByDoctor: Map<string, DoctorSchedule[]>;
  exceptionsByDoctor: Map<string, DoctorException[]>;
  apptsByDoctorDate: Map<string, Map<string, Appt[]>>;
  onPickSlot: (doctorId: string, date: string, time: string) => void;
  onCancelAppt: (a: Appt) => void;
  onReschedule: (a: Appt) => void;
  onOpenAppt: (a: Appt) => void;
}) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dow = getDayOfWeek(dateStr);

  const columns = doctors.map((d) => {
    const schedule = (schedulesByDoctor.get(d.id) ?? []).find((s) => s.day_of_week === dow) ?? null;
    const exception = (exceptionsByDoctor.get(d.id) ?? []).find((e) => e.exception_date === dateStr) ?? null;
    const appts = apptsByDoctorDate.get(d.id)?.get(dateStr) ?? [];
    const activeAppts = appts.filter((a) => a.status !== "cancelled");
    const cancelledAppts = appts.filter((a) => a.status === "cancelled");
    const { slots, reason } = generateSlots({
      schedule, exception, appointments: activeAppts as unknown as ExistingAppointment[], date: dateStr,
    });
    const byTime = new Map<string, Appt[]>();
    for (const a of activeAppts) {
      const key = a.appointment_time?.substring(0, 5);
      if (!key) continue;
      if (!byTime.has(key)) byTime.set(key, []);
      byTime.get(key)!.push(a);
    }
    return { doctor: d, schedule, exception, reason, slots, byTime, activeAppts, cancelledAppts, color: doctorColor(allDoctorIds, d.id) };
  });

  const timeSet = new Set<string>();
  for (const col of columns) {
    for (const s of col.slots) timeSet.add(s.time);
    for (const t of col.byTime.keys()) timeSet.add(t);
  }
  const times = Array.from(timeSet).sort();

  if (doctors.length === 0) {
    return <Card className="shadow-card"><CardContent className="py-10 text-center text-sm text-muted-foreground">Select at least one doctor to view the calendar.</CardContent></Card>;
  }

  const renderApptContent = (a: Appt) => {
    const t = typeStyle[apptType(a)];
    return (
      <div
        key={a.id}
        onClick={() => onOpenAppt(a)}
        className={cn("flex h-full w-full cursor-pointer flex-col gap-0.5 rounded-r-md border-l-[3px] px-2 py-1.5 text-left", t.border, t.bg)}
      >
        <div className="flex items-center justify-between gap-1">
          <span className={cn("truncate text-[11px] font-semibold", a.status === "cancelled" && "line-through text-muted-foreground")}>
            {a.patient?.name ?? "—"}
          </span>
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot[a.status] ?? "bg-muted-foreground")} />
        </div>
        <span className={cn("truncate text-[9.5px]", t.text)}>
          {a.services && a.services.length > 0 ? a.services.slice(0, 1).join(", ") : t.label}
        </span>
        {a.status !== "completed" && a.status !== "cancelled" && (
          <div className="mt-0.5 flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onReschedule(a); }}
              className="rounded border px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-background"
            >Reschedule</button>
            <button
              onClick={(e) => { e.stopPropagation(); onCancelAppt(a); }}
              className="rounded border border-red-300 px-1.5 py-0.5 text-[9px] text-red-600 hover:bg-red-50"
            >Cancel</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="shadow-card overflow-x-auto"><CardContent className="p-0">
      <div className="grid min-w-fit" style={{ gridTemplateColumns: `72px repeat(${columns.length}, minmax(180px, 1fr))` }}>
        <div className="border-b bg-muted/30" />
        {columns.map(({ doctor, color, activeAppts }) => (
          <div key={doctor.id} className="flex items-center gap-2 border-b border-l bg-muted/30 px-3 py-2.5">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", color.avatarBg, color.avatarText)}>
              {doctorInitial(doctor.name)}
            </span>
            <span className="truncate text-[12.5px] font-semibold">{formatDoctorName(doctor.name)}</span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{activeAppts.length} appts</span>
          </div>
        ))}

        {times.length === 0 && (
          <div className="col-span-full py-10 text-center text-sm text-muted-foreground" style={{ gridColumn: `1 / span ${columns.length + 1}` }}>
            No availability configured for the selected doctors on this day.
          </div>
        )}

        {times.map((time) => (
          <div key={time} className="contents">
            <div className="flex items-start border-b px-2 py-2 text-[10.5px] text-muted-foreground">{to12h(time)}</div>
            {columns.map((col) => {
              const list = col.byTime.get(time);
              const slot = col.slots.find((s) => s.time === time);
              return (
                <div key={col.doctor.id} className="min-h-[52px] border-b border-l p-1">
                  {list && list.length > 0 ? (
                    <div className="flex h-full flex-col gap-1">
                      {list.map((a) => renderApptContent(a))}
                    </div>
                  ) : slot && col.reason === "ok" ? (
                    slot.past ? (
                      <div className="flex h-full items-center px-2 text-[10px] text-muted-foreground/60">Past</div>
                    ) : (
                      <button
                        onClick={() => onPickSlot(col.doctor.id, dateStr, time)}
                        className="flex h-full w-full items-center rounded border border-dashed px-2 text-left text-[10px] text-muted-foreground hover:bg-muted"
                      >
                        + Book
                      </button>
                    )
                  ) : (
                    <div className="flex h-full items-center px-2 text-[10px] text-muted-foreground/40">—</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {columns.some((c) => c.cancelledAppts.length > 0) && (
        <div className="border-t p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase text-red-700">Cancelled</div>
          <div className="space-y-1">
            {columns.flatMap((c) => c.cancelledAppts).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpenAppt(a)}
                className="flex w-full items-center gap-3 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-left text-sm hover:bg-red-100"
              >
                <span className="w-16 font-mono text-xs text-red-700">{a.appointment_time?.slice(0, 5)}</span>
                {a.patient && <span className="text-red-700 line-through">{a.patient.name}</span>}
                <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">Cancelled</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </CardContent></Card>
  );
}
