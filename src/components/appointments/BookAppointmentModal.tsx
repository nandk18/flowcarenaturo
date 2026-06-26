import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn, formatDoctorName } from "@/lib/utils";
import CheckInModal, { type CheckInData } from "@/components/queue/CheckInModal";
import {
  generateSlots,
  type DoctorSchedule,
  type DoctorException,
  type ExistingAppointment,
} from "@/lib/scheduleSlots";

type Patient = { id: string; name: string; phone: string | null };
type Doctor = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onBooked?: () => void;
  initialDate?: string;          // yyyy-MM-dd
  initialTime?: string;          // HH:mm
  initialDoctorId?: string;
  initialPatientId?: string;
  lockDate?: boolean;
  lockPatient?: boolean;
  /** When true (dashboard walk-in flow) AND date is today, show CheckIn modal after booking. */
  walkInFlow?: boolean;
};

export default function BookAppointmentModal({
  open,
  onClose,
  onBooked,
  initialDate,
  initialTime,
  initialDoctorId,
  initialPatientId,
  lockDate,
  lockPatient: lockPatientProp,
  walkInFlow,
}: Props) {
  const [lockPatient, setLockPatient] = useState(!!lockPatientProp);
  const { profile } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState(initialPatientId ?? "");
  const [patientOpen, setPatientOpen] = useState(false);
  const [doctorId, setDoctorId] = useState(initialDoctorId ?? "");
  const [date, setDate] = useState(initialDate ?? format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(initialTime ?? "");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [exceptions, setExceptions] = useState<DoctorException[]>([]);
  const [dayAppts, setDayAppts] = useState<ExistingAppointment[]>([]);

  const [bookedAppt, setBookedAppt] = useState<{ id: string; patientName: string; time: string; patientId: string; doctorId: string } | null>(null);

  type ServiceOption = { id: string; name: string; amount: number };
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    // Restore draft from localStorage if it exists (only when no specific initial values overridden).
    let restored: any = null;
    try {
      const raw = localStorage.getItem("flowcare_form_book_appointment");
      if (raw) restored = JSON.parse(raw);
    } catch { /* ignore */ }
    setPatientId(initialPatientId ?? restored?.patientId ?? "");
    setLockPatient(!!lockPatientProp);
    setDoctorId(initialDoctorId ?? restored?.doctorId ?? "");
    setDate(initialDate ?? restored?.date ?? format(new Date(), "yyyy-MM-dd"));
    setTime(initialTime ?? restored?.time ?? "");
    setReason(restored?.reason ?? "");
    setNotes(restored?.notes ?? "");
    setPatientSearch("");
    setSelectedServiceIds([]);
  }, [open, initialPatientId, initialDoctorId, initialDate, initialTime, lockPatientProp]);

  // Persist draft on every relevant change while the modal is open.
  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(
        "flowcare_form_book_appointment",
        JSON.stringify({ patientId, doctorId, date, time, reason, notes })
      );
    } catch { /* ignore */ }
  }, [open, patientId, doctorId, date, time, reason, notes]);

  const clearAppointmentDraft = () => {
    try { localStorage.removeItem("flowcare_form_book_appointment"); } catch { /* ignore */ }
  };

  // Load doctors
  useEffect(() => {
    if (!open || !profile?.clinic_id) return;
    supabase.from("doctors").select("id, name").eq("clinic_id", profile.clinic_id).order("name")
      .then(({ data }) => {
        const list = (data ?? []) as Doctor[];
        setDoctors(list);
        if (!doctorId && list[0]) setDoctorId(list[0].id);
      });
  }, [open, profile?.clinic_id]);

  // Load services
  useEffect(() => {
    if (!open || !profile?.clinic_id) return;
    supabase
      .from("invoice_services")
      .select("id, name, amount, is_default")
      .eq("clinic_id", profile.clinic_id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("name")
      .then(({ data }) => {
        const list = (data ?? []) as any[];
        setServices(list.map((s) => ({ id: s.id, name: s.name, amount: Number(s.amount) })));
        // Preselect default service if none chosen yet
        setSelectedServiceIds((prev) => {
          if (prev.length) return prev;
          const def = list.find((s) => s.is_default);
          return def ? [def.id] : [];
        });
      });
  }, [open, profile?.clinic_id]);


  // Patient search
  useEffect(() => {
    if (!open || !profile?.clinic_id) return;
    const q = patientSearch.trim();
    const run = async () => {
      let qb = supabase.from("patients").select("id, name, phone").eq("clinic_id", profile.clinic_id).limit(20);
      if (q) qb = qb.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
      else qb = qb.order("created_at", { ascending: false });
      const { data } = await qb;
      setPatients((data ?? []) as Patient[]);
    };
    const t = setTimeout(run, 200);
    return () => clearTimeout(t);
  }, [open, patientSearch, profile?.clinic_id]);

  // Pre-select patient name lookup
  useEffect(() => {
    if (!patientId || patients.find((p) => p.id === patientId)) return;
    supabase.from("patients").select("id, name, phone").eq("id", patientId).maybeSingle()
      .then(({ data }) => { if (data) setPatients((prev) => [data as Patient, ...prev]); });
  }, [patientId]);

  // Load schedule + appts for picked doctor + date
  useEffect(() => {
    if (!open || !doctorId || !date) { setSchedules([]); setExceptions([]); setDayAppts([]); return; }
    (async () => {
      const [sched, exc, ap] = await Promise.all([
        (supabase as any).from("doctor_schedules").select("*").eq("doctor_id", doctorId),
        (supabase as any).from("doctor_exceptions").select("*").eq("doctor_id", doctorId).eq("exception_date", date),
        supabase.from("appointments")
          .select("id, appointment_time, status, patients(id, name)")
          .eq("doctor_id", doctorId).eq("appointment_date", date),
      ]);
      setSchedules(sched.data ?? []);
      setExceptions(exc.data ?? []);
      setDayAppts((ap.data ?? []).map((a: any) => ({
        id: a.id, appointment_time: a.appointment_time, status: a.status,
        patient: Array.isArray(a.patients) ? a.patients[0] : a.patients,
      })));
    })();
  }, [open, doctorId, date]);

  const slots = useMemo(() => {
    if (!doctorId || !date) return [];
    const dow = new Date(date + "T00:00:00").getDay();
    const schedule = schedules.find((s) => s.day_of_week === dow) ?? null;
    const exception = exceptions[0] ?? null;
    if (!schedule) {
      // Fallback: every 30 min 9-18
      const out: { time: string; available: boolean }[] = [];
      for (let h = 9; h < 18; h++) {
        for (const m of [0, 30]) {
          const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const taken = dayAppts.some((a) => a.appointment_time?.startsWith(t));
          out.push({ time: t, available: !taken });
        }
      }
      return out;
    }
    return generateSlots({ schedule, exception, appointments: dayAppts, date })
      .slots.map((s) => ({ time: s.time, available: s.available }));
  }, [doctorId, date, schedules, exceptions, dayAppts]);

  const selectedPatient = patients.find((p) => p.id === patientId);

  const handleBook = async () => {
    if (!profile?.clinic_id) return;
    if (!patientId || !doctorId || !date || !time) {
      toast.error("Patient, doctor, date and time are required");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("appointments").insert({
        clinic_id: profile.clinic_id,
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_date: date,
        appointment_time: time.length === 5 ? `${time}:00` : time,
        status: "scheduled",
        reason: reason || null,
        notes: notes || null,
        created_by: profile.user_id,
      }).select("id").single();
      if (error) throw error;
      // Save selected services for this appointment
      if (selectedServiceIds.length && data?.id) {
        await supabase.from("appointment_services").insert(
          selectedServiceIds.map((sid) => ({
            clinic_id: profile.clinic_id,
            appointment_id: data.id,
            service_id: sid,
          })),
        );
      }
      await supabase.from("patients").update({ lead_status: "current" }).eq("id", patientId);
      toast.success("Appointment booked");
      const today = format(new Date(), "yyyy-MM-dd");
      const shouldCheckIn = !!walkInFlow && date === today;
      if (shouldCheckIn) {
        setBookedAppt({
          id: data!.id,
          patientName: selectedPatient?.name ?? "",
          time,
          patientId,
          doctorId,
        });
      }
      clearAppointmentDraft();
      onBooked?.();
      if (!shouldCheckIn) onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to book");
    } finally {
      setBusy(false);
    }
  };

  const handleCheckIn = async (data: CheckInData | null) => {
    if (!bookedAppt || !profile?.clinic_id) return;
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      if (date === today) {
        const { data: last } = await supabase.from("visits")
          .select("token_number").eq("clinic_id", profile.clinic_id)
          .eq("visit_date", today).order("token_number", { ascending: false }).limit(1).maybeSingle();
        const nextToken = (last?.token_number ?? 0) + 1;
        const payload: any = {
          clinic_id: profile.clinic_id,
          patient_id: bookedAppt.patientId,
          doctor_id: bookedAppt.doctorId,
          token_number: nextToken,
          chief_complaint: data?.chief_complaint || reason || null,
          status: "waiting",
          visit_date: today,
        };
        if (data) {
          payload.height_cm = data.height_cm;
          payload.weight_kg = data.weight_kg;
          payload.captured_at_reception = true;
        }
        await supabase.from("visits").insert(payload);
        toast.success(`Added to queue as #${nextToken}`);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add to queue");
    } finally {
      setBookedAppt(null);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={open && !bookedAppt} onOpenChange={(o) => { if (!o && !busy) { clearAppointmentDraft(); onClose(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Patient *</Label>
                {lockPatient && selectedPatient && (
                  <button
                    type="button"
                    onClick={() => setLockPatient(false)}
                    className="text-xs text-primary hover:underline"
                  >
                    change
                  </button>
                )}
              </div>
              {lockPatient && selectedPatient ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium">{selectedPatient.name}</span>
                  {selectedPatient.phone && (
                    <span className="ml-2 text-xs text-muted-foreground">{selectedPatient.phone}</span>
                  )}
                </div>
              ) : (
                <Popover open={patientOpen} onOpenChange={setPatientOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {selectedPatient ? `${selectedPatient.name}${selectedPatient.phone ? ` · ${selectedPatient.phone}` : ""}` : "Search by name or phone…"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Search patient…" value={patientSearch} onValueChange={setPatientSearch} />
                      <CommandList>
                        <CommandEmpty>No patients found.</CommandEmpty>
                        <CommandGroup>
                          {patients.map((p) => (
                            <CommandItem key={p.id} value={p.id} onSelect={() => { setPatientId(p.id); setPatientOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", patientId === p.id ? "opacity-100" : "opacity-0")} />
                              {p.name} {p.phone && <span className="ml-auto text-xs text-muted-foreground">{p.phone}</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Doctor *</Label>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{formatDoctorName(d.name)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={date} disabled={lockDate} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Time *</Label>
              {slots.length === 0 ? (
                <p className="text-xs text-muted-foreground">Pick a doctor & date to see slots.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 max-h-48 overflow-y-auto">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available && time !== s.time}
                      onClick={() => setTime(s.time)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-xs font-mono transition-colors",
                        time === s.time && "ring-2 ring-primary",
                        s.available
                          ? "border-success/30 bg-success/5 hover:bg-success/15"
                          : "border-border bg-muted/50 text-muted-foreground cursor-not-allowed",
                      )}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Chief reason for visit" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={handleBook} disabled={busy || !patientId || !doctorId || !date || !time}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Book Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CheckInModal
        open={!!bookedAppt}
        patientName={bookedAppt?.patientName ?? ""}
        appointmentTime={bookedAppt?.time}
        onClose={() => { setBookedAppt(null); onClose(); }}
        onConfirm={handleCheckIn}
      />
    </>
  );
}
