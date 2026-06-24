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

type Doctor = { id: string; name: string };
type Appt = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string | null;
  patient: { id: string; name: string } | null;
};
type View = "day" | "week" | "month";

const statusDot: Record<string, string> = {
  scheduled: "bg-info",
  confirmed: "bg-primary",
  completed: "bg-success",
  cancelled: "bg-destructive",
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

  // Auto-open modal when ?patient= present
  useEffect(() => {
    if (shouldAutoOpen) {
      setModalInit({ patientId: presetPatientId, lockPatient: !!presetPatientId });
      setModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Range to fetch based on view
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

  const fetchAppts = useCallback(async () => {
    if (!profile?.clinic_id || !doctorId) { setAppts([]); return; }
    const { data } = await supabase.from("appointments")
      .select("id, appointment_date, appointment_time, status, reason, patients(id, name)")
      .eq("clinic_id", profile.clinic_id)
      .eq("doctor_id", doctorId)
      .gte("appointment_date", format(rangeStart, "yyyy-MM-dd"))
      .lte("appointment_date", format(rangeEnd, "yyyy-MM-dd"))
      .order("appointment_time");
    setAppts((data ?? []).map((a: any) => ({
      ...a,
      patient: Array.isArray(a.patients) ? a.patients[0] : a.patients,
    })));
  }, [profile?.clinic_id, doctorId, rangeStart, rangeEnd]);

  useEffect(() => { fetchAppts(); }, [fetchAppts]);

  // Realtime
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

      {view === "month" && (
        <MonthView cursor={cursor} apptsByDate={apptsByDate} onPickDay={(d) => { setCursor(d); setView("day"); }} />
      )}
      {view === "week" && (
        <WeekView cursor={cursor} apptsByDate={apptsByDate} onPickSlot={(d, t) => openBook(d, t)} />
      )}
      {view === "day" && (
        <DayView date={cursor} appts={apptsByDate.get(format(cursor, "yyyy-MM-dd")) ?? []} onPickSlot={(d, t) => openBook(d, t)} />
      )}

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
    </MainShell>
  );
}

function MonthView({
  cursor, apptsByDate, onPickDay,
}: { cursor: Date; apptsByDate: Map<string, any[]>; onPickDay: (d: Date) => void }) {
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
          const tint = items.length === 0 ? "bg-background" : items.length >= 8 ? "bg-destructive/5" : "bg-success/5";
          return (
            <button
              key={dateStr}
              onClick={() => onPickDay(day)}
              className={cn(
                "min-h-[96px] rounded-md border p-1 text-left text-xs flex flex-col gap-1",
                tint,
                !inMonth && "opacity-40",
                today && "ring-2 ring-primary",
              )}
            >
              <span className="font-semibold">{format(day, "d")}</span>
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {items.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center gap-1 truncate rounded bg-background/70 px-1 py-0.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot[a.status] ?? "bg-muted-foreground")} />
                    <span className="font-mono">{a.appointment_time?.substring(0, 5)}</span>
                    <span className="truncate">{a.patient?.name ?? "—"}</span>
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
  cursor, apptsByDate, onPickSlot,
}: { cursor: Date; apptsByDate: Map<string, Appt[]>; onPickSlot: (date: string, time: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor, { weekStartsOn: 1 }), i));
  return (
    <Card className="shadow-card"><CardContent className="p-3">
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const items = apptsByDate.get(dateStr) ?? [];
          const today = isSameDay(day, new Date());
          return (
            <div key={dateStr} className={cn("rounded-md border p-2", today && "ring-2 ring-primary")}>
              <div className="mb-2 text-xs font-semibold">{format(day, "EEE d")}</div>
              <div className="space-y-1">
                {items.length === 0 && (
                  <button onClick={() => onPickSlot(dateStr, "")} className="w-full rounded border border-dashed py-2 text-[10px] text-muted-foreground hover:bg-muted">+ Book</button>
                )}
                {items.map((a) => (
                  <div key={a.id} className="rounded border bg-background p-1.5 text-[11px]">
                    <div className="flex items-center gap-1">
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusDot[a.status] ?? "bg-muted-foreground")} />
                      <span className="font-mono">{a.appointment_time?.substring(0, 5)}</span>
                    </div>
                    {a.patient && <PatientLink patientId={a.patient.id} className="block truncate text-xs">{a.patient.name}</PatientLink>}
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
  date, appts, onPickSlot,
}: { date: Date; appts: Appt[]; onPickSlot: (date: string, time: string) => void }) {
  const dateStr = format(date, "yyyy-MM-dd");
  // Build 15-min slots 8:00-20:00
  const slots: string[] = [];
  for (let h = 8; h < 20; h++) for (const m of [0, 15, 30, 45]) slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  const byTime = new Map<string, Appt>();
  for (const a of appts) byTime.set(a.appointment_time?.substring(0, 5), a);
  return (
    <Card className="shadow-card"><CardContent className="p-3">
      <div className="space-y-1">
        {slots.map((t) => {
          const a = byTime.get(t);
          return (
            <button
              key={t}
              onClick={() => !a && onPickSlot(dateStr, t)}
              disabled={!!a}
              className={cn(
                "flex w-full items-center gap-3 rounded border px-3 py-2 text-left text-sm",
                a ? "border-primary/30 bg-primary/5" : "border-dashed hover:bg-muted",
              )}
            >
              <span className="w-16 font-mono text-xs text-primary">{t}</span>
              {a ? (
                <div className="flex flex-1 items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", statusDot[a.status] ?? "bg-muted-foreground")} />
                  {a.patient && <PatientLink patientId={a.patient.id}>{a.patient.name}</PatientLink>}
                  {a.reason && <span className="text-xs text-muted-foreground">— {a.reason}</span>}
                  <span className="ml-auto text-[10px] uppercase text-muted-foreground">{a.status}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Available — click to book</span>
              )}
            </button>
          );
        })}
      </div>
    </CardContent></Card>
  );
}
