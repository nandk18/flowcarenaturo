import { useEffect, useMemo, useState } from "react";
import SettingsShell from "@/components/layout/SettingsShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Save,
  CalendarPlus,
  AlertTriangle,
  Download,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { DAY_FULL, DAY_NAMES, ScheduleSession } from "@/lib/scheduleSlots";
import { format, addMonths } from "date-fns";
import { formatDoctorName } from "@/lib/utils";

const SLOT_DURATIONS = [10, 15, 20, 30, 45, 60];

type DayState = {
  active: boolean;
  sessions: ScheduleSession[];
  slot_duration_minutes: number;
};

type Doctor = { id: string; name: string };
type Exception = {
  id: string;
  doctor_id: string;
  exception_date: string;
  type: "leave" | "holiday" | "emergency";
  reason: string | null;
  affects_appointments: boolean;
  is_full_day?: boolean | null;
  start_time?: string | null;
  end_time?: string | null;
};
type ConflictAppt = {
  id: string;
  appointment_time: string;
  patient: { id: string; name: string; phone: string | null } | null;
};

const emptyDay = (): DayState => ({
  active: false,
  sessions: [{ start: "09:00", end: "13:00" }],
  slot_duration_minutes: 15,
});

export default function DoctorSchedulePage() {
  const { profile } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [days, setDays] = useState<DayState[]>(
    Array.from({ length: 7 }, emptyDay),
  );
  const [originalActive, setOriginalActive] = useState<boolean[]>(Array.from({ length: 7 }, () => false));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [excDialogOpen, setExcDialogOpen] = useState(false);
  const [excDate, setExcDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [excType, setExcType] = useState<"leave" | "holiday" | "emergency">("leave");
  const [excReason, setExcReason] = useState("");
  const [excAffects, setExcAffects] = useState(true);
  const [excFullDay, setExcFullDay] = useState(true);
  const [excStartTime, setExcStartTime] = useState("09:00");
  const [excEndTime, setExcEndTime] = useState("13:00");
  const [savingExc, setSavingExc] = useState(false);

  const [conflicts, setConflicts] = useState<ConflictAppt[] | null>(null);
  const [pendingExc, setPendingExc] = useState<null | {
    date: string;
    type: "leave" | "holiday" | "emergency";
    reason: string;
    affects: boolean;
  }>(null);
  const [calledMap, setCalledMap] = useState<Record<string, boolean>>({});
  const [cancelledList, setCancelledList] = useState<ConflictAppt[] | null>(null);

  // Pending confirmation when disabling weekdays that have future appointments
  const [dayOffConfirm, setDayOffConfirm] = useState<null | {
    disabledDays: number[]; // day_of_week values (0..6)
    appts: (ConflictAppt & { appointment_date: string; day_of_week: number })[];
  }>(null);


  // load doctors
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
          setSelectedDoctorId((prev) => prev || data[0].id);
        } else {
          setDoctors([]);
          setLoading(false);
        }
      });
  }, [profile?.clinic_id]);

  // load schedule + exceptions for the doctor
  useEffect(() => {
    if (!selectedDoctorId || !profile?.clinic_id) return;
    setLoading(true);
    (async () => {
      const [schedRes, excRes] = await Promise.all([
        (supabase as any)
          .from("doctor_schedules")
          .select("*")
          .eq("doctor_id", selectedDoctorId),
        (supabase as any)
          .from("doctor_exceptions")
          .select("*")
          .eq("doctor_id", selectedDoctorId)
          .gte("exception_date", format(new Date(), "yyyy-MM-dd"))
          .order("exception_date"),
      ]);
      const next = Array.from({ length: 7 }, emptyDay);
      for (const row of schedRes.data || []) {
        const idx = row.day_of_week;
        next[idx] = {
          active: row.is_active ?? true,
          sessions:
            Array.isArray(row.sessions) && row.sessions.length > 0
              ? row.sessions
              : [{ start: "09:00", end: "13:00" }],
          slot_duration_minutes: row.slot_duration_minutes || 15,
        };
      }
      setDays(next);
      setOriginalActive(next.map((d) => d.active));
      setExceptions(excRes.data || []);
      setLoading(false);
    })();
  }, [selectedDoctorId, profile?.clinic_id]);


  const updateDay = (idx: number, patch: Partial<DayState>) => {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };
  const updateSession = (
    dayIdx: number,
    sIdx: number,
    patch: Partial<ScheduleSession>,
  ) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? {
              ...d,
              sessions: d.sessions.map((s, j) =>
                j === sIdx ? { ...s, ...patch } : s,
              ),
            }
          : d,
      ),
    );
  };
  const addSession = (dayIdx: number) =>
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? { ...d, sessions: [...d.sessions, { start: "15:00", end: "18:00" }] }
          : d,
      ),
    );
  const removeSession = (dayIdx: number, sIdx: number) =>
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? { ...d, sessions: d.sessions.filter((_, j) => j !== sIdx) }
          : d,
      ),
    );

  const persistSchedule = async () => {
    if (!selectedDoctorId || !profile?.clinic_id) return;
    const rows = days.map((d, idx) => ({
      clinic_id: profile.clinic_id,
      doctor_id: selectedDoctorId,
      day_of_week: idx,
      sessions: d.active ? d.sessions : [],
      slot_duration_minutes: d.slot_duration_minutes,
      is_active: d.active,
    }));
    const { error } = await (supabase as any)
      .from("doctor_schedules")
      .upsert(rows, { onConflict: "doctor_id,day_of_week" });
    if (error) throw error;
    setOriginalActive(days.map((d) => d.active));
  };

  const handleSave = async () => {
    if (!selectedDoctorId || !profile?.clinic_id) return;
    setSaving(true);
    try {
      // Detect weekdays flipped active -> inactive
      const disabledDays: number[] = [];
      for (let i = 0; i < 7; i++) {
        if (originalActive[i] === true && days[i].active === false) disabledDays.push(i);
      }

      if (disabledDays.length > 0) {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const { data: futureAppts } = await supabase
          .from("appointments")
          .select("id, appointment_date, appointment_time, patients(id, name, phone)")
          .eq("doctor_id", selectedDoctorId)
          .gte("appointment_date", todayStr)
          .in("status", ["scheduled", "confirmed"]);

        const affected = ((futureAppts as any[]) ?? [])
          .map((a) => {
            const d = new Date(a.appointment_date + "T00:00:00");
            // JS day: 0=Sun..6=Sat; DoW column: 0=Sun..6=Sat (matches)
            const dow = d.getDay();
            return {
              id: a.id,
              appointment_date: a.appointment_date,
              appointment_time: a.appointment_time,
              day_of_week: dow,
              patient: Array.isArray(a.patients) ? a.patients[0] : a.patients,
            };
          })
          .filter((a) => disabledDays.includes(a.day_of_week));

        if (affected.length > 0) {
          setDayOffConfirm({ disabledDays, appts: affected });
          setSaving(false);
          return;
        }
      }

      await persistSchedule();
      toast.success("Schedule saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDayOffAndSave = async () => {
    if (!dayOffConfirm || !profile?.clinic_id) return;
    setSaving(true);
    try {
      const ids = dayOffConfirm.appts.map((a) => a.id);
      const dayNames = dayOffConfirm.disabledDays.map((d) => DAY_FULL[d]).join(", ");
      if (ids.length > 0) {
        await (supabase as any)
          .from("appointments")
          .update({
            status: "cancelled",
            notes: `Cancelled: Doctor no longer available on ${dayNames}`,
          })
          .in("id", ids);

        // Also create call_logs so reception can inform patients
        const nowIso = new Date().toISOString();
        const callLogRows = dayOffConfirm.appts
          .filter((a) => a.patient?.id)
          .map((a) => ({
            patient_id: a.patient!.id,
            clinic_id: profile.clinic_id,
            outcome: "no_answer",
            notes: `Appointment cancelled: Doctor no longer available on ${DAY_FULL[a.day_of_week]}`,
            source: "appointment_cancelled" as any,
            called_at: nowIso,
          }));
        if (callLogRows.length > 0) {
          await (supabase as any).from("call_logs").insert(callLogRows);
        }
      }
      await persistSchedule();
      setCancelledList(
        dayOffConfirm.appts.map((a) => ({
          id: a.id,
          appointment_time: a.appointment_time,
          patient: a.patient,
        })),
      );
      setCalledMap({});
      setDayOffConfirm(null);
      toast.success(`Schedule saved · ${ids.length} appointment(s) cancelled`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };


  // Exceptions
  const refreshExceptions = async () => {
    if (!selectedDoctorId) return;
    const { data } = await (supabase as any)
      .from("doctor_exceptions")
      .select("*")
      .eq("doctor_id", selectedDoctorId)
      .gte("exception_date", format(new Date(), "yyyy-MM-dd"))
      .order("exception_date");
    setExceptions(data || []);
  };

  const handleStartSaveException = async () => {
    if (!selectedDoctorId || !profile?.clinic_id || !excDate) return;
    if (!excFullDay && excStartTime >= excEndTime) {
      toast.error("End time must be after start time");
      return;
    }
    setSavingExc(true);
    try {
      if (excAffects) {
        const { data: appts } = await supabase
          .from("appointments")
          .select(
            "id, appointment_time, patients(id, name, phone)",
          )
          .eq("doctor_id", selectedDoctorId)
          .eq("appointment_date", excDate)
          .neq("status", "cancelled");
        let list: ConflictAppt[] = (appts || []).map((a: any) => ({
          id: a.id,
          appointment_time: a.appointment_time,
          patient: Array.isArray(a.patients) ? a.patients[0] : a.patients,
        }));
        // For partial-day exception, only conflicts within the blocked range
        if (!excFullDay) {
          list = list.filter((a) => {
            const t = (a.appointment_time || "").substring(0, 5);
            return t >= excStartTime && t < excEndTime;
          });
        }
        if (list.length > 0) {
          setPendingExc({
            date: excDate,
            type: excType,
            reason: excReason,
            affects: excAffects,
          });
          setConflicts(list);
          setSavingExc(false);
          return;
        }
      }
      await persistException(excDate, excType, excReason, excAffects, []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingExc(false);
    }
  };

  const persistException = async (
    date: string,
    type: "leave" | "holiday" | "emergency",
    reason: string,
    affects: boolean,
    apptsToCancel: ConflictAppt[],
  ) => {
    if (!selectedDoctorId || !profile?.clinic_id) return;
    const { error } = await (supabase as any)
      .from("doctor_exceptions")
      .insert({
        clinic_id: profile.clinic_id,
        doctor_id: selectedDoctorId,
        exception_date: date,
        type,
        reason: reason || null,
        affects_appointments: affects,
        is_full_day: excFullDay,
        start_time: excFullDay ? null : excStartTime,
        end_time: excFullDay ? null : excEndTime,
      });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (apptsToCancel.length > 0) {
      const cancelNote = `Cancelled: Doctor unavailable - ${reason || type}`;
      const ids = apptsToCancel.map((a) => a.id);
      await (supabase as any)
        .from("appointments")
        .update({ status: "cancelled", notes: cancelNote })
        .in("id", ids);

      // Generate Cancel Call tasks so reception can inform each affected patient.
      const nowIso = new Date().toISOString();
      const callLogRows = apptsToCancel
        .filter((a) => a.patient?.id)
        .map((a) => ({
          patient_id: a.patient!.id,
          clinic_id: profile.clinic_id,
          outcome: "no_answer",
          notes: `Appointment cancelled: ${reason || `Doctor ${type}`}`,
          source: "appointment_cancelled" as any,
          called_at: nowIso,
        }));
      if (callLogRows.length > 0) {
        await (supabase as any).from("call_logs").insert(callLogRows);
      }

      setCancelledList(apptsToCancel);
      setCalledMap({});
    }
    toast.success("Exception saved");
    setExcDialogOpen(false);
    setConflicts(null);
    setPendingExc(null);
    setExcReason("");
    setExcFullDay(true);
    await refreshExceptions();
  };

  const handleConfirmCancellations = async () => {
    if (!pendingExc || !conflicts) return;
    await persistException(
      pendingExc.date,
      pendingExc.type,
      pendingExc.reason,
      pendingExc.affects,
      conflicts,
    );
  };

  const handleDeleteException = async (id: string) => {
    await (supabase as any).from("doctor_exceptions").delete().eq("id", id);
    toast.success("Exception removed");
    refreshExceptions();
  };

  const exportCancelledCSV = () => {
    if (!cancelledList) return;
    const rows = [
      ["Patient", "Phone", "Original Time", "Called"].join(","),
      ...cancelledList.map((a) =>
        [
          a.patient?.name || "",
          a.patient?.phone || "",
          a.appointment_time?.substring(0, 5) || "",
          calledMap[a.id] ? "Yes" : "No",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cancelled-appointments-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const maxExceptionDate = format(addMonths(new Date(), 3), "yyyy-MM-dd");

  const headerRight = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setExcDialogOpen(true)}
        disabled={!selectedDoctorId}
      >
        <CalendarPlus className="mr-1 h-4 w-4" /> Add Exception
      </Button>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving || !selectedDoctorId}
      >
        {saving ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-1 h-4 w-4" />
        )}
        Save Schedule
      </Button>
    </div>
  );

  return (
    <SettingsShell title="Settings · Doctor Schedule" headerRight={headerRight}>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Doctor</Label>
          <Select
            value={selectedDoctorId}
            onValueChange={setSelectedDoctorId}
          >
            <SelectTrigger className="w-[260px] rounded-lg">
              <SelectValue placeholder="Select a doctor" />
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

      {doctors.length === 0 && !loading && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No doctors yet. Add a doctor profile under Clinic Profile or Staff
            Members first.
          </CardContent>
        </Card>
      )}

      {loading && selectedDoctorId && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && selectedDoctorId && (
        <>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-lg">
                Weekly Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Order Mon..Sun */}
              {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                const d = days[dayIdx];
                return (
                  <div
                    key={dayIdx}
                    className={`rounded-xl border border-border p-3 transition-colors ${
                      d.active ? "bg-background" : "bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-[120px]">
                        <Switch
                          checked={d.active}
                          onCheckedChange={(v) =>
                            updateDay(dayIdx, { active: v })
                          }
                        />
                        <div>
                          <div className="font-medium">
                            {DAY_FULL[dayIdx]}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {d.active ? "Available" : "Not Available"}
                          </div>
                        </div>
                      </div>
                      {!d.active && (
                        <div className="text-xs text-muted-foreground italic">
                          — Not Available —
                        </div>
                      )}
                      {d.active && (
                        <div className="flex-1 space-y-2">
                          {d.sessions.map((s, sIdx) => (
                            <div
                              key={sIdx}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <Input
                                type="time"
                                value={s.start}
                                onChange={(e) =>
                                  updateSession(dayIdx, sIdx, {
                                    start: e.target.value,
                                  })
                                }
                                className="w-[120px] rounded-lg"
                              />
                              <span className="text-muted-foreground">─</span>
                              <Input
                                type="time"
                                value={s.end}
                                onChange={(e) =>
                                  updateSession(dayIdx, sIdx, {
                                    end: e.target.value,
                                  })
                                }
                                className="w-[120px] rounded-lg"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => removeSession(dayIdx, sIdx)}
                                disabled={d.sessions.length === 1}
                                aria-label="Remove session"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              variant="link"
                              size="sm"
                              className="px-0"
                              onClick={() => addSession(dayIdx)}
                            >
                              <Plus className="mr-1 h-3 w-3" /> Add Session
                            </Button>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground">
                                Slot
                              </Label>
                              <Select
                                value={String(d.slot_duration_minutes)}
                                onValueChange={(v) =>
                                  updateDay(dayIdx, {
                                    slot_duration_minutes: Number(v),
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 w-[110px] rounded-lg">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SLOT_DURATIONS.map((m) => (
                                    <SelectItem key={m} value={String(m)}>
                                      {m} min
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="mt-6 rounded-2xl border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg">
                Leaves & Exceptions
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExcDialogOpen(true)}
              >
                <Plus className="mr-1 h-4 w-4" /> Add Exception
              </Button>
            </CardHeader>
            <CardContent>
              {exceptions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No upcoming exceptions
                </p>
              ) : (
                <div className="space-y-2">
                  {exceptions.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="font-medium w-[110px]">
                        {format(new Date(e.exception_date), "MMM d, yyyy")}
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {e.type}
                      </Badge>
                      <div className="flex-1 text-sm text-muted-foreground truncate">
                        {e.is_full_day === false && e.start_time && e.end_time
                          ? `${e.start_time.substring(0, 5)}–${e.end_time.substring(0, 5)} · ${e.reason || ""}`
                          : (e.reason || "Full day")}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          e.affects_appointments
                            ? "border-warning/30 text-warning"
                            : ""
                        }
                      >
                        {e.affects_appointments
                          ? "Affects bookings"
                          : "Informational"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteException(e.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {cancelledList && (
            <Card className="mt-6 rounded-2xl border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display text-lg">
                  Call these patients
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={exportCancelledCSV}>
                    <Download className="mr-1 h-4 w-4" /> Export CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCancelledList(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {cancelledList.map((a) => {
                  const phone = a.patient?.phone || "";
                  const wa = phone
                    ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}`
                    : "";
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <input
                        type="checkbox"
                        checked={!!calledMap[a.id]}
                        onChange={(e) =>
                          setCalledMap((m) => ({
                            ...m,
                            [a.id]: e.target.checked,
                          }))
                        }
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {a.patient?.name || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {phone || "no phone"} ·{" "}
                          {a.appointment_time?.substring(0, 5)}
                        </div>
                      </div>
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-success hover:opacity-80"
                          aria-label="Open WhatsApp"
                        >
                          <MessageCircle className="h-5 w-5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Add Exception Dialog */}
      <Dialog open={excDialogOpen} onOpenChange={setExcDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Exception</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Doctor</Label>
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                {formatDoctorName(
                  doctors.find((d) => d.id === selectedDoctorId)?.name,
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={excDate}
                min={today}
                max={maxExceptionDate}
                onChange={(e) => setExcDate(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={excType}
                onValueChange={(v: any) => setExcType(v)}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leave">Leave</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={excReason}
                onChange={(e) => setExcReason(e.target.value)}
                placeholder="Optional"
                className="rounded-lg"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label>Affects Appointments</Label>
                <p className="text-xs text-muted-foreground">
                  Block bookings and cancel existing ones on this date.
                </p>
              </div>
              <Switch checked={excAffects} onCheckedChange={setExcAffects} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label>Full Day</Label>
                <p className="text-xs text-muted-foreground">
                  Off: block only a specific time range below.
                </p>
              </div>
              <Switch checked={excFullDay} onCheckedChange={setExcFullDay} />
            </div>
            {!excFullDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={excStartTime}
                    onChange={(e) => setExcStartTime(e.target.value)}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End</Label>
                  <Input
                    type="time"
                    value={excEndTime}
                    onChange={(e) => setExcEndTime(e.target.value)}
                    className="rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExcDialogOpen(false)}
              disabled={savingExc}
            >
              Cancel
            </Button>
            <Button onClick={handleStartSaveException} disabled={savingExc}>
              {savingExc && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Save Exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict warning */}
      <Dialog
        open={!!conflicts}
        onOpenChange={(o) => {
          if (!o) {
            setConflicts(null);
            setPendingExc(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {conflicts?.length} appointment
              {conflicts?.length === 1 ? "" : "s"} on this date
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Saving this exception will cancel the following appointments.
          </p>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {conflicts?.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-border p-2 text-sm"
              >
                <div className="font-mono text-primary">
                  {a.appointment_time?.substring(0, 5)}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{a.patient?.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.patient?.phone || "no phone"}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConflicts(null);
                setPendingExc(null);
              }}
            >
              Cancel & Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancellations}
            >
              Confirm & Cancel Appointments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day-off confirmation (weekday turned off) */}
      <Dialog
        open={!!dayOffConfirm}
        onOpenChange={(o) => {
          if (!o) setDayOffConfirm(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {dayOffConfirm?.appts.length} future appointment
              {dayOffConfirm?.appts.length === 1 ? "" : "s"} affected
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Turning off {dayOffConfirm?.disabledDays.map((d) => DAY_FULL[d]).join(", ")} will cancel these appointments.
          </p>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {dayOffConfirm?.appts.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-border p-2 text-sm"
              >
                <div className="font-mono text-primary text-xs w-24 shrink-0">
                  {a.appointment_date} {a.appointment_time?.substring(0, 5)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.patient?.name || "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.patient?.phone || "no phone"}</div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayOffConfirm(null)}>
              Cancel & Go Back
            </Button>
            <Button variant="destructive" onClick={confirmDayOffAndSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Cancel Appointments & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsShell>
  );
}

