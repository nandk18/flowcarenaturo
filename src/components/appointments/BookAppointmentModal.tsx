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
  // Map of appointment_id -> kind ('consultation' | 'treatment'). Default (no linked services) => 'consultation'.
  const [apptKinds, setApptKinds] = useState<Record<string, "consultation" | "treatment">>({});

  const [bookedAppt, setBookedAppt] = useState<{ id: string; patientName: string; time: string; patientId: string; doctorId: string } | null>(null);

  type ServiceOption = { id: string; name: string; description?: string | null; amount: number; gst_percentage?: number; service_type?: string | null };
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
      .select("id, name, description, amount, gst_percentage, is_default, service_type")
      .eq("clinic_id", profile.clinic_id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("name")
      .then(({ data }) => {
        const list = (data ?? []) as any[];
        setServices(list.map((s) => ({
          id: s.id, name: s.name, description: s.description,
          amount: Number(s.amount), gst_percentage: Number(s.gst_percentage ?? 0),
          service_type: s.service_type ?? null,
        })));
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
    if (!open || !doctorId || !date) { setSchedules([]); setExceptions([]); setDayAppts([]); setApptKinds({}); return; }
    (async () => {
      const [sched, exc, ap] = await Promise.all([
        (supabase as any).from("doctor_schedules").select("*").eq("doctor_id", doctorId),
        (supabase as any).from("doctor_exceptions").select("*").eq("doctor_id", doctorId).eq("exception_date", date),
        supabase.from("appointments")
          .select("id, appointment_time, status, patients(id, name), appointment_services(service_id, invoice_services(service_type))")
          .eq("doctor_id", doctorId).eq("appointment_date", date),
      ]);
      setSchedules(sched.data ?? []);
      setExceptions(exc.data ?? []);
      const rows = (ap.data ?? []) as any[];
      setDayAppts(rows.map((a: any) => ({
        id: a.id, appointment_time: a.appointment_time, status: a.status,
        patient: Array.isArray(a.patients) ? a.patients[0] : a.patients,
      })));
      const kinds: Record<string, "consultation" | "treatment"> = {};
      for (const a of rows) {
        const svcs = (a.appointment_services ?? []) as any[];
        if (svcs.length === 0) { kinds[a.id] = "consultation"; continue; }
        const anyConsult = svcs.some((r) => (r.invoice_services?.service_type ?? "consultation") !== "treatment");
        kinds[a.id] = anyConsult ? "consultation" : "treatment";
      }
      setApptKinds(kinds);
    })();
  }, [open, doctorId, date]);

  // Kind of the booking currently being made
  const bookingKind: "consultation" | "treatment" = useMemo(() => {
    if (selectedServiceIds.length === 0) return "consultation";
    const chosen = services.filter((s) => selectedServiceIds.includes(s.id));
    const anyConsult = chosen.some((s) => (s.service_type ?? "consultation") !== "treatment");
    return anyConsult ? "consultation" : "treatment";
  }, [selectedServiceIds, services]);

  // Appointments that block a slot: only consultations block. Treatments never block.
  const blockingAppts = useMemo(() => {
    if (bookingKind === "treatment") return [] as ExistingAppointment[];
    return dayAppts.filter((a) => apptKinds[a.id] !== "treatment");
  }, [dayAppts, apptKinds, bookingKind]);

  const slots = useMemo(() => {
    if (!doctorId || !date) return [];
    const dow = new Date(date + "T00:00:00").getDay();
    const schedule = schedules.find((s) => s.day_of_week === dow) ?? null;
    const exception = exceptions[0] ?? null;
    if (!schedule) {
      const out: { time: string; available: boolean }[] = [];
      for (let h = 9; h < 18; h++) {
        for (const m of [0, 30]) {
          const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const taken = blockingAppts.some((a) => a.appointment_time?.startsWith(t));
          out.push({ time: t, available: !taken });
        }
      }
      return out;
    }
    return generateSlots({ schedule, exception, appointments: blockingAppts, date })
      .slots.map((s) => ({ time: s.time, available: s.available }));
  }, [doctorId, date, schedules, exceptions, blockingAppts]);

  const selectedPatient = patients.find((p) => p.id === patientId);

  const handleBook = async () => {
    if (!profile?.clinic_id) return;
    if (!patientId || !doctorId || !date || !time) {
      toast.error("Patient, doctor, date and time are required");
      return;
    }
    // Consultation slot conflict: only one consultation per doctor/date/time
    if (bookingKind === "consultation") {
      const normTime = time.length === 5 ? `${time}:00` : time;
      const clash = dayAppts.find(
        (a) => a.appointment_time?.startsWith(time) && apptKinds[a.id] !== "treatment" && a.status !== "cancelled",
      );
      if (clash) {
        toast.error("Another consultation is already booked at this time. Multiple treatments are allowed, but only one consultation per slot.");
        return;
      }
      // Re-check server-side to avoid race
      const { data: existing } = await supabase
        .from("appointments")
        .select("id, appointment_services(invoice_services(service_type))")
        .eq("doctor_id", doctorId)
        .eq("appointment_date", date)
        .eq("appointment_time", normTime)
        .neq("status", "cancelled");
      const serverClash = (existing ?? []).some((a: any) => {
        const svcs = a.appointment_services ?? [];
        if (svcs.length === 0) return true;
        return svcs.some((r: any) => (r.invoice_services?.service_type ?? "consultation") !== "treatment");
      });
      if (serverClash) {
        toast.error("Another consultation was just booked at this time. Pick a different slot.");
        return;
      }
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

      // Invoice handling: treatments are billed on completion, not booking.
      // - Treatment-only booking: delete the auto-created invoice.
      // - Mixed/consultation: override invoice line_items with only non-treatment services.
      if (data?.id) {
        await new Promise((r) => setTimeout(r, 150));
        const { data: inv } = await supabase
          .from("invoices")
          .select("id, paid_amount")
          .eq("appointment_id", data.id)
          .maybeSingle();

        if (inv?.id) {
          const chosenAll = services.filter((s) => selectedServiceIds.includes(s.id));
          const billable = chosenAll.filter((s) => (s.service_type ?? "consultation") !== "treatment");

          if (bookingKind === "treatment" || (chosenAll.length > 0 && billable.length === 0)) {
            // All-treatment: remove auto invoice entirely
            if (Number(inv.paid_amount ?? 0) === 0) {
              await supabase.from("invoices").delete().eq("id", inv.id);
            }
          } else if (billable.length > 0) {
            const lineItems = billable.map((s) => {
              const gstPct = s.gst_percentage ?? 0;
              const lineTotal = s.amount + (s.amount * gstPct) / 100;
              return {
                name: s.name,
                description: s.description ?? "",
                quantity: 1,
                unit_price: s.amount,
                gst_percentage: gstPct,
                total: lineTotal,
                service_id: s.id,
                appointment_id: data.id,
              };
            });
            const subtotal = billable.reduce((sum, s) => sum + s.amount, 0);
            const gstAmount = billable.reduce(
              (sum, s) => sum + (s.amount * (s.gst_percentage ?? 0)) / 100, 0,
            );
            const total = subtotal + gstAmount;
            const paid = Number(inv.paid_amount ?? 0);
            await supabase.from("invoices").update({
              line_items: lineItems as any,
              subtotal,
              gst_amount: gstAmount,
              total_amount: total,
              outstanding_amount: Math.max(0, total - paid),
              pdf_url: null,
              pdf_generated_at: null,
              updated_at: new Date().toISOString(),
            } as any).eq("id", inv.id);
          }
          // else: no services selected → keep the default consultation invoice as-is
        }

        // Ensure an active plan/plan-item exists for treatment services so the
        // patient's Treatment tab reflects the booking immediately.
        if (bookingKind === "treatment") {
          try {
            const chosenAll = services.filter((s) => selectedServiceIds.includes(s.id));
            const { ensureIndividualPlanForServices } = await import("@/lib/treatmentStart");
            await ensureIndividualPlanForServices({
              clinicId: profile.clinic_id,
              patientId,
              notes: notes || null,
              startDate: date,
              appointmentId: data?.id ?? null,
              services: chosenAll.map((s) => ({
                service_id: s.id,
                invoice_services: { id: s.id, name: s.name, service_type: s.service_type ?? null, amount: s.amount ?? 0 },
              })),
            });
          } catch (e) {
            // non-fatal
            console.warn("ensureIndividualPlanForServices failed", e);
          }
        }
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
      // Do not create a "visit" (clinical queue row) for treatment-only bookings —
      // treatments are handled on the Treatment Board, not the doctor queue.
      if (date === today && bookingKind !== "treatment") {
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

            <ServicesSearchField
              services={services}
              selectedIds={selectedServiceIds}
              onChange={setSelectedServiceIds}
            />

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

type ServiceOpt = { id: string; name: string; description?: string | null; amount: number; gst_percentage?: number };

function ServicesSearchField({
  services, selectedIds, onChange,
}: { services: ServiceOpt[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const selected = services.filter((s) => selectedIds.includes(s.id));
  const matches = q.trim()
    ? services.filter((s) => !selectedIds.includes(s.id) && s.name.toLowerCase().includes(q.trim().toLowerCase()))
    : [];
  const total = selected.reduce((sum, s) => sum + s.amount + (s.amount * (s.gst_percentage ?? 0)) / 100, 0);
  return (
    <div className="space-y-2">
      <Label>Services (optional)</Label>
      <div className="rounded-md border p-2">
        <Input
          placeholder="Search services..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q.trim() && (
          <div className="mt-1 max-h-40 overflow-y-auto rounded border bg-background">
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No services found. Configure in Settings → Billing → Invoice Services
              </p>
            ) : matches.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { onChange([...selectedIds, s.id]); setQ(""); }}
                className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">₹{s.amount}</span>
              </button>
            ))}
          </div>
        )}
        {selected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                <Check className="h-3 w-3" /> {s.name} ₹{s.amount}
                <button
                  type="button"
                  onClick={() => onChange(selectedIds.filter((x) => x !== s.id))}
                  className="ml-1 text-primary/60 hover:text-primary"
                  aria-label="Remove"
                >×</button>
              </span>
            ))}
          </div>
        )}
        {selected.length > 0 && (
          <p className="mt-1 text-xs font-medium text-foreground">Total: ₹{total.toLocaleString("en-IN")}</p>
        )}
      </div>
    </div>
  );
}
