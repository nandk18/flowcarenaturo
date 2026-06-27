import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Copy, MessageCircle } from "lucide-react";
import PatientLink from "@/components/PatientLink";
import { buildMessage } from "@/lib/messageTemplates";
import { openWhatsApp } from "@/lib/whatsapp";
import { getProfileId } from "@/utils/getProfileId";
import { useClinic } from "@/hooks/useClinic";

type Props = {
  open: boolean;
  onClose: () => void;
  appointment: {
    id: string;
    clinic_id: string;
    patient_id: string;
    appointment_date: string;
    appointment_time: string | null;
    patient_name: string;
    patient_phone?: string | null;
  } | null;
  onCancelled?: () => void;
};

const REASONS = [
  { value: "Doctor unavailable", label: "Doctor unavailable" },
  { value: "Patient requested", label: "Patient requested" },
  { value: "Clinic emergency", label: "Clinic emergency" },
  { value: "No show", label: "No show" },
  { value: "Other", label: "Other" },
];

export default function CancelAppointmentModal({ open, onClose, appointment, onCancelled }: Props) {
  const { clinic } = useClinic();
  const [reason, setReason] = useState<string>("Patient requested");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setReason("Patient requested");
    setNotes("");
    setSubmitting(false);
    setDone(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
    if (done) onCancelled?.();
  };

  if (!appointment) return null;

  const handleConfirm = async () => {
    if (!appointment) return;
    setSubmitting(true);
    try {
      const combinedNote = notes.trim() ? `${reason} - ${notes.trim()}` : reason;

      // 1. Cancel the appointment
      const { error: apptErr } = await (supabase as any)
        .from("appointments")
        .update({ status: "cancelled", notes: combinedNote })
        .eq("id", appointment.id);
      if (apptErr) throw apptErr;

      // 2. Cancel linked UNPAID invoice (if any)
      await (supabase as any)
        .from("invoices")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("appointment_id", appointment.id)
        .eq("status", "unpaid");

      // 3. Add to call_logs + bump patient call_due_date
      const userId = await getProfileId();
      await supabase.from("call_logs").insert({
        patient_id: appointment.patient_id,
        clinic_id: appointment.clinic_id,
        outcome: "no_answer",
        notes: `Appointment cancelled: ${combinedNote}`,
        source: "appointment_cancelled" as any,
        called_by: userId,
        called_at: new Date().toISOString(),
      } as any);

      const today = format(new Date(), "yyyy-MM-dd");
      await (supabase as any)
        .from("patients")
        .update({ call_due_date: today })
        .eq("id", appointment.patient_id);

      setDone(true);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to cancel appointment");
    } finally {
      setSubmitting(false);
    }
  };

  const sendWhatsApp = async () => {
    if (!appointment) return;
    const msg = await buildMessage(appointment.clinic_id, "appointment_cancelled_notice", {
      patient_name: appointment.patient_name,
      clinic_name: clinic?.name ?? "our clinic",
      appointment_date: format(new Date(appointment.appointment_date), "dd MMM yyyy"),
      appointment_time: appointment.appointment_time?.slice(0, 5) ?? "",
      reason,
    });
    openWhatsApp(appointment.patient_phone ?? "", msg);
  };

  const copyPhone = async () => {
    if (!appointment.patient_phone) return;
    try {
      await navigator.clipboard.writeText(appointment.patient_phone);
      toast.success("Phone copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {!done ? (
          <>
            <DialogHeader>
              <DialogTitle>Cancel Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-semibold">{appointment.patient_name}</div>
                <div className="text-muted-foreground">
                  {format(new Date(appointment.appointment_date), "dd MMM yyyy")}
                  {appointment.appointment_time ? ` · ${appointment.appointment_time.slice(0, 5)}` : ""}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Additional notes (optional)</Label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="More context for the cancellation..."
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                Keep Appointment
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting ? "Cancelling..." : "Cancel Appointment"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Appointment Cancelled</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Call this patient to inform them:</p>
              <div className="rounded-lg border p-3 space-y-2">
                <PatientLink patientId={appointment.patient_id} className="text-sm font-semibold">
                  {appointment.patient_name}
                </PatientLink>
                {appointment.patient_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono">{appointment.patient_phone}</span>
                    <button
                      onClick={copyPhone}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Copy phone"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 border-green-300"
                  onClick={sendWhatsApp}
                  disabled={!appointment.patient_phone}
                >
                  <MessageCircle className="mr-1 h-3.5 w-3.5" /> Send WhatsApp
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
