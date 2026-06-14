import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConsultShell from "@/components/layout/ConsultShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Search,
} from "lucide-react";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  DoctorException,
  DoctorSchedule,
  ExistingAppointment,
  GeneratedSlot,
  generateSlots,
  getDaySummary,
} from "@/lib/scheduleSlots";
import { formatDoctorName } from "@/lib/utils";

type Doctor = { id: string; name: string };

const COLOR: Record<string, string> = {
  available: "bg-success/15 text-success border-success/30 hover:bg-success/25",
  partial: "bg-warning/15 text-warning border-warning/30 hover:bg-warning/25",
  full: "bg-destructive/15 text-destructive border-destructive/30",
  off: "bg-muted text-muted-foreground border-border",
  past: "bg-muted/50 text-muted-foreground/60 border-border",
};

export default function AvailabilityPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [exceptions, setExceptions] = useState<DoctorException[]>([]);
  const [appts, setAppts] = useState<
    (ExistingAppointment & { appointment_date: string })[]
  >([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // search-availability
  const [searchFrom, setSearchFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchTo, setSearchTo] = useState(
    format(addMonths(new Date(), 1), "yyyy-MM-dd"),
  );
  const [searchN, setSearchN] = useState(10);

  useEffect(() => {
    if (!profile?.clinic_id) return;
    supabase
      .from("doctors")
      .select("id, name")
      .eq("clinic_id", profile.clinic_id)
      .order("name")
      .then(({ data }) => {
        if (data && data.length) {
          setDoctors(data);
          setDoctorId((p) => p || data[0].id);
        }
      });
  }, [profile?.clinic_id]);

  useEffect(() => {
    if (!doctorId || !profile?.clinic_id) return;
    setLoading(true);
    const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");
    (async () => {
      const [sched, exc, ap] = await Promise.all([
        (supabase as any)
          .from("doctor_schedules")
          .select("*")
          .eq("doctor_id", doctorId),
        (supabase as any)
          .from("doctor_exceptions")
          .select("*")
          .eq("doctor_id", doctorId)
          .gte("exception_date", monthStart)
          .lte("exception_date", monthEnd),
        supabase
          .from("appointments")
          .select(
            "id, appointment_date, appointment_time, status, patients(id, name, phone)",
          )
          .eq("doctor_id", doctorId)
          .gte("appointment_date", monthStart)
          .lte("appointment_date", monthEnd),
      ]);
      setSchedules(sched.data || []);
      setExceptions(exc.data || []);
      setAppts(
        (ap.data || []).map((a: any) => ({
          id: a.id,
          appointment_date: a.appointment_date,
          appointment_time: a.appointment_time,
          status: a.status,
          patient: Array.isArray(a.patients) ? a.patients[0] : a.patients,
        })),
      );
      setLoading(false);
    })();
  }, [doctorId, month, profile?.clinic_id]);

  const dayCells = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
    return cells;
  }, [month]);

  const dataForDate = (dateStr: string) => {
    const dow = new Date(dateStr + "T00:00:00").getDay();
    const schedule = schedules.find((s) => s.day_of_week === dow) || null;
    const exception =
      exceptions.find((e) => e.exception_date === dateStr) || null;
    const dayAppts = appts.filter((a) => a.appointment_date === dateStr);
    return { schedule, exception, appointments: dayAppts };
  };

  const slotsForSelected = useMemo<GeneratedSlot[]>(() => {
    if (!selectedDay) return [];
    const { schedule, exception, appointments } = dataForDate(selectedDay);
    return generateSlots({
      schedule,
      exception,
      appointments,
      date: selectedDay,
    }).slots;
  }, [selectedDay, schedules, exceptions, appts]);

  const goBook = (date?: string, time?: string) => {
    const params = new URLSearchParams();
    if (doctorId) params.set("doctor_id", doctorId);
    if (date) params.set("date", date);
    if (time) params.set("time", time);
    navigate(`/consult/appointments/new?${params.toString()}`);
  };

  // search availability
  const searchResults = useMemo(() => {
    if (!doctorId) return [];
    const from = new Date(searchFrom + "T00:00:00");
    const to = new Date(searchTo + "T00:00:00");
    const out: { date: string; time: string }[] = [];
    let cursor = new Date(from);
    while (cursor <= to && out.length < searchN) {
      const dateStr = format(cursor, "yyyy-MM-dd");
      const { schedule, exception, appointments } = dataForDate(dateStr);
      const { slots } = generateSlots({
        schedule,
        exception,
        appointments,
        date: dateStr,
      });
      for (const s of slots) {
        if (s.available) {
          out.push({ date: dateStr, time: s.time });
          if (out.length >= searchN) break;
        }
      }
      cursor = addDays(cursor, 1);
    }
    return out;
  }, [doctorId, searchFrom, searchTo, searchN, schedules, exceptions, appts]);

  const headerRight = (
    <Button size="sm" onClick={() => goBook()}>
      <Plus className="mr-1 h-4 w-4" /> Book Appointment
    </Button>
  );

  const morningSlots = slotsForSelected.filter((s) => s.group === "morning");
  const afternoonSlots = slotsForSelected.filter(
    (s) => s.group === "afternoon",
  );
  const eveningSlots = slotsForSelected.filter((s) => s.group === "evening");

  return (
    <ConsultShell title="Availability" headerRight={headerRight}>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Doctor</Label>
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger className="w-[240px] rounded-lg">
              <SelectValue placeholder="Select doctor" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {formatDoctorName(d.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="search">
            <Search className="mr-1 h-4 w-4" /> Search Availability
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-display text-lg font-semibold">
              {format(month, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {dayCells.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const inMonth = day.getMonth() === month.getMonth();
              const { schedule, exception, appointments } =
                dataForDate(dateStr);
              const summary = getDaySummary({
                schedule,
                exception,
                appointments,
                date: dateStr,
              });
              const cls = COLOR[summary];
              const selected = selectedDay === dateStr;
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDay(dateStr)}
                  className={`aspect-square rounded-lg border p-1 text-xs flex flex-col items-start ${cls} ${
                    !inMonth ? "opacity-40" : ""
                  } ${selected ? "ring-2 ring-primary" : ""}`}
                >
                  <span className="font-semibold">{format(day, "d")}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-success/40" /> Available
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-warning/40" /> Partial
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-destructive/40" /> Full
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-muted" /> Off / Past
            </span>
          </div>

          {selectedDay && (
            <Card className="mt-6 rounded-2xl border-0 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <div className="font-display text-lg font-semibold">
                    {format(new Date(selectedDay + "T00:00:00"), "EEEE, MMM d")}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedDay(null)}
                  >
                    Close
                  </Button>
                </div>
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : slotsForSelected.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Doctor is not available on this date.
                  </p>
                ) : (
                  <>
                    {[
                      ["MORNING", morningSlots],
                      ["AFTERNOON", afternoonSlots],
                      ["EVENING", eveningSlots],
                    ].map(([label, list]) => {
                      const items = list as GeneratedSlot[];
                      if (items.length === 0) return null;
                      return (
                        <div key={label as string}>
                          <div className="mb-2 text-xs font-semibold text-muted-foreground">
                            {label}
                          </div>
                          <div className="space-y-1">
                            {items.map((s) => (
                              <button
                                key={s.time}
                                disabled={!s.available && !s.appointment}
                                onClick={() => {
                                  if (s.appointment?.patient?.id) {
                                    window.open(
                                      `/consult/patients/${s.appointment.patient.id}`,
                                      "_blank",
                                    );
                                  } else if (s.available) {
                                    goBook(selectedDay, s.time);
                                  }
                                }}
                                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                                  s.available
                                    ? "border-success/30 bg-success/5 hover:bg-success/10"
                                    : s.appointment
                                      ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                                      : "border-border bg-muted/50 text-muted-foreground"
                                }`}
                              >
                                <span className="font-mono text-primary">
                                  {s.time}
                                </span>
                                {s.appointment ? (
                                  <span className="flex-1">
                                    Booked —{" "}
                                    {s.appointment.patient?.name || "—"}
                                  </span>
                                ) : s.past ? (
                                  <span>Past</span>
                                ) : (
                                  <span>Available</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="search">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1">
              <Label>From</Label>
              <Input
                type="date"
                value={searchFrom}
                min={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setSearchFrom(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input
                type="date"
                value={searchTo}
                max={format(addMonths(new Date(), 3), "yyyy-MM-dd")}
                onChange={(e) => setSearchTo(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label>Show</Label>
              <Select
                value={String(searchN)}
                onValueChange={(v) => setSearchN(Number(v))}
              >
                <SelectTrigger className="w-[120px] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 slots</SelectItem>
                  <SelectItem value="10">10 slots</SelectItem>
                  <SelectItem value="20">20 slots</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {searchResults.length === 0 ? (
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No available slots in this range.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {searchResults.map((r) => (
                <div
                  key={`${r.date}-${r.time}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                >
                  <div className="w-40 text-sm">
                    {format(
                      new Date(r.date + "T00:00:00"),
                      "EEE, MMM d yyyy",
                    )}
                  </div>
                  <div className="font-mono text-primary">{r.time}</div>
                  <div className="flex-1" />
                  <Button size="sm" onClick={() => goBook(r.date, r.time)}>
                    Book
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </ConsultShell>
  );
}
