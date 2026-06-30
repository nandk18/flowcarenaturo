import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  generateSlots, type DoctorSchedule, type DoctorException, type ExistingAppointment,
} from "@/lib/scheduleSlots";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  open: boolean;
  onClose: () => void;
  onRescheduled?: () => void;
  appointment: {
    id: string;
    clinic_id: string;
    patient_id: string;
    doctor_id: string | null;
    appointment_date: string;
    appointment_time: string | null;
    patient_name: string;
    doctor_name?: string | null;
    reason?: string | null;
    notes?: string | null;
  } | null;
};

export default function RescheduleAppointmentModal({ open, onClose, onRescheduled, appointment }: Props) {
  const { profile } = useAuth();
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [exceptions, setExceptions] = useState<DoctorException[]>([]);
  const [dayAppts, setDayAppts] = useState<ExistingAppointment[]>([]);

  useEffect(() => {
    if (!open || !appointment) return;
    setNewDate(appointment.appointment_date);
    setNewTime("");
    setReason("");
  }, [open, appointment]);

  useEffect(() => {
    if (!open || !appointment?.doctor_id) return;
    (supabase as any).from("doctor_schedules").select("*").eq("doctor_id", appointment.doctor_id)
      .then(({ data }: any) => setSchedules((data ?? []) as DoctorSchedule[]));
  }, [open, appointment?.doctor_id]);

  useEffect(() => {
    if (!open || !appointment?.doctor_id || !newDate) return;
    (async () => {
      const [exc, ap] = await Promise.all([
        (supabase as any).from("doctor_exceptions").select("*").eq("doctor_id", appointment.doctor_id).eq("exception_date", newDate),
        supabase.from("appointments")
          .select("id, appointment_time, status")
          .eq("doctor_id", appointment.doctor_id).eq("appointment_date", newDate),
      ]);
      setExceptions(exc.data ?? []);
      setDayAppts((ap.data ?? []).map((a: any) => ({
        id: a.id, appointment_time: a.appointment_time, status: a.status, patient: null,
      })));
    })();
  }, [open, appointment?.doctor_id, newDate]);

  const slots = useMemo(() => {
    if (!appointment?.doctor_id || !newDate) return [];
    const dow = new Date(newDate + "T00:00:00").getDay();
    const schedule = schedules.find((s) => s.day_of_week === dow) ?? null;
    if (!schedule) return [];
    return generateSlots({
      schedule, exception: exceptions[0] ?? null,
      appointments: dayAppts.filter((a) => a.id !== appointment.id) as any,
      date: newDate,
    }).slots;
  }, [appointment, newDate, schedules, exceptions, dayAppts]);

  const handleConfirm = async () => {
    if (!appointment || !newDate || !newTime || !profile?.clinic_id) {
      toast.error("Pick a new date and time");
      return;
    }
    setBusy(true);
    let oldCancelled = false;
    let prevStatus: string | null = null;
    try {
      const newTimeFull = newTime.length === 5 ? `${newTime}:00` : newTime;

      // 1. Fetch full old appointment to copy fields & remember status for rollback
      const { data: old, error: e0 } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointment.id)
        .single();
      if (e0 || !old) throw e0 ?? new Error("Old appointment not found");
      prevStatus = (old as any).status ?? "scheduled";

      // 2. CANCEL old appointment FIRST so it never lingers as "scheduled"
      const oldNote = `Rescheduled to ${newDate} at ${newTime}${reason ? ` — ${reason}` : ""}`;
      const { error: eCancel } = await (supabase as any)
        .from("appointments")
        .update({
          status: "cancelled",
          cancellation_reason: "Rescheduled",
          notes: oldNote,
        })
        .eq("id", appointment.id);
      if (eCancel) throw eCancel;
      oldCancelled = true;

      // 3. Insert new appointment with rescheduled_from set (trigger skips invoice)
      const insertPayload: any = {
        clinic_id: old.clinic_id,
        patient_id: old.patient_id,
        doctor_id: old.doctor_id,
        appointment_date: newDate,
        appointment_time: newTimeFull,
        status: "scheduled",
        reason: old.reason,
        notes: reason
          ? `Rescheduled from ${appointment.appointment_date} ${appointment.appointment_time?.slice(0, 5) ?? ""} — ${reason}`
          : `Rescheduled from ${appointment.appointment_date} ${appointment.appointment_time?.slice(0, 5) ?? ""}`,
        created_by: profile.user_id,
        rescheduled_from: appointment.id,
      };
      const { data: newAppt, error: e1 } = await supabase
        .from("appointments")
        .insert(insertPayload)
        .select("id")
        .single();
      if (e1 || !newAppt) throw e1 ?? new Error("Failed to create new appointment");

      // 4. Link the pair on the old row
      await (supabase as any)
        .from("appointments")
        .update({ rescheduled_to: newAppt.id })
        .eq("id", appointment.id);

      // 5. Copy appointment_services old → new
      const { data: oldServices } = await (supabase as any)
        .from("appointment_services")
        .select("service_id")
        .eq("appointment_id", appointment.id);
      if (oldServices && oldServices.length) {
        await (supabase as any).from("appointment_services").insert(
          oldServices.map((s: any) => ({
            clinic_id: old.clinic_id,
            appointment_id: newAppt.id,
            service_id: s.service_id,
          })),
        );
      }

      // 6. Re-point any existing invoice from old to new appointment (keep same invoice)
      await (supabase as any)
        .from("invoices")
        .update({ appointment_id: newAppt.id, updated_at: new Date().toISOString() })
        .eq("appointment_id", appointment.id)
        .neq("status", "cancelled");

      toast.success(`Appointment rescheduled to ${format(new Date(newDate + "T00:00:00"), "dd MMM")} at ${newTime}`);
      onRescheduled?.();
      onClose();
    } catch (e: any) {
      // Rollback the cancel if the new appointment failed to insert
      if (oldCancelled && prevStatus && appointment) {
        await (supabase as any)
          .from("appointments")
          .update({ status: prevStatus, cancellation_reason: null })
          .eq("id", appointment.id);
      }
      toast.error(e?.message ?? "Reschedule failed");
    } finally {
      setBusy(false);
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="font-semibold">{appointment.patient_name}</div>
            <div className="text-muted-foreground">
              {format(new Date(appointment.appointment_date + "T00:00:00"), "dd MMM yyyy")}
              {appointment.appointment_time ? ` · ${appointment.appointment_time.slice(0,5)}` : ""}
              {appointment.doctor_name ? ` · ${appointment.doctor_name}` : ""}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">New Date</Label>
              <Input type="date" value={newDate} onChange={(e) => { setNewDate(e.target.value); setNewTime(""); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason (optional)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. patient request" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">New Time</Label>
            {slots.length === 0 ? (
              <p className="text-xs text-muted-foreground">No schedule for this date.</p>
            ) : (
              <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    disabled={!s.available && newTime !== s.time}
                    onClick={() => setNewTime(s.time)}
                    className={cn(
                      "rounded-md border px-2 py-1.5 font-mono text-xs",
                      newTime === s.time && "ring-2 ring-primary",
                      s.available
                        ? "border-success/30 bg-success/5 hover:bg-success/15"
                        : "cursor-not-allowed border-border bg-muted/50 text-muted-foreground",
                    )}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!newDate || !newTime ? (
            <p className="text-[11px] text-muted-foreground">No new invoice is created — this is the same visit at a new time.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={busy || !newDate || !newTime}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
