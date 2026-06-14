import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  DoctorException,
  DoctorSchedule,
  generateSlots,
} from "@/lib/scheduleSlots";
import { formatDoctorName } from "@/lib/utils";

type Doctor = { id: string; name: string };
type Patient = {
  id: string;
  name: string;
  healthcare_id: string | null;
  phone: string | null;
};

export default function WalkInDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}) {
  const { profile } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creatingPatient, setCreatingPatient] = useState(false);

  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [exception, setException] = useState<DoctorException | null>(null);
  const [dayAppts, setDayAppts] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (!open || !profile?.clinic_id) return;
    supabase
      .from("doctors")
      .select("id, name")
      .eq("clinic_id", profile.clinic_id)
      .then(({ data }) => {
        if (data && data.length) {
          setDoctors(data);
          setDoctorId((p) => p || data[0].id);
        }
      });
  }, [open, profile?.clinic_id]);

  useEffect(() => {
    if (!doctorId || !open) return;
    let cancelled = false;
    setLoadingSlots(true);
    (async () => {
      const dow = new Date(today + "T00:00:00").getDay();
      const [sched, exc, ap] = await Promise.all([
        (supabase as any)
          .from("doctor_schedules")
          .select("*")
          .eq("doctor_id", doctorId)
          .eq("day_of_week", dow)
          .maybeSingle(),
        (supabase as any)
          .from("doctor_exceptions")
          .select("*")
          .eq("doctor_id", doctorId)
          .eq("exception_date", today)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("id, appointment_time, status")
          .eq("doctor_id", doctorId)
          .eq("appointment_date", today),
      ]);
      if (cancelled) return;
      setSchedule((sched.data as DoctorSchedule) || null);
      setException((exc.data as DoctorException) || null);
      setDayAppts(ap.data || []);
      setLoadingSlots(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [doctorId, open, today]);

  const slotResult = generateSlots({
    schedule,
    exception,
    appointments: dayAppts as any,
    date: today,
  });

  const searchPatients = async (q: string) => {
    setSearch(q);
    if (q.length < 2 || !profile?.clinic_id) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from("patients")
      .select("id, name, healthcare_id, phone")
      .eq("clinic_id", profile.clinic_id)
      .or(`name.ilike.%${q}%,healthcare_id.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(10);
    if (data) setResults(data);
  };

  const createPatient = async () => {
    if (!newName.trim() || !profile?.clinic_id) return;
    setCreatingPatient(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .insert({
          clinic_id: profile.clinic_id,
          name: newName.trim(),
          phone: newPhone || null,
          lead_status: "current",
        } as any)
        .select("id, name, healthcare_id, phone")
        .single();
      if (error) throw error;
      setPatient(data as Patient);
      setNewName("");
      setNewPhone("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingPatient(false);
    }
  };

  const handleSave = async () => {
    if (!patient || !doctorId || !time || !profile?.clinic_id) return;
    setSaving(true);
    try {
      // 1. Insert appointment
      const { error: apptErr } = await (supabase as any)
        .from("appointments")
        .insert({
          clinic_id: profile.clinic_id,
          patient_id: patient.id,
          doctor_id: doctorId,
          appointment_date: today,
          appointment_time: time,
          duration_minutes: schedule?.slot_duration_minutes || 15,
          reason: reason || "Walk-in",
          status: "confirmed",
          created_by: profile.user_id || null,
        });
      if (apptErr) throw apptErr;

      // 2. Promote lead
      await supabase
        .from("patients")
        .update({ lead_status: "current" })
        .eq("id", patient.id);

      // 3. Create visit with next token
      const { data: lastVisit } = await supabase
        .from("visits")
        .select("token_number")
        .eq("clinic_id", profile.clinic_id)
        .eq("visit_date", today)
        .order("token_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextToken = (lastVisit?.token_number || 0) + 1;

      const { error: visitErr } = await supabase.from("visits").insert({
        clinic_id: profile.clinic_id,
        patient_id: patient.id,
        doctor_id: doctorId,
        token_number: nextToken,
        chief_complaint: reason || null,
        status: "waiting",
        visit_date: today,
      });
      if (visitErr) throw visitErr;

      toast.success(`Added to queue as #${nextToken}`);
      onCreated?.();
      onOpenChange(false);
      // reset
      setPatient(null);
      setSearch("");
      setResults([]);
      setTime("");
      setReason("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Walk-in Appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Patient</Label>
            {patient ? (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{patient.name}</span>
                <button
                  className="ml-auto text-xs text-destructive"
                  onClick={() => setPatient(null)}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Search name, ID, phone…"
                  value={search}
                  onChange={(e) => searchPatients(e.target.value)}
                  className="rounded-lg"
                />
                {results.length > 0 && (
                  <div className="max-h-40 overflow-auto rounded-lg border">
                    {results.map((p) => (
                      <button
                        key={p.id}
                        className="block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"
                        onClick={() => {
                          setPatient(p);
                          setResults([]);
                          setSearch(p.name);
                        }}
                      >
                        <span className="font-medium">{p.name}</span>
                        {p.healthcare_id && (
                          <span className="ml-2 font-mono text-xs text-primary">
                            {p.healthcare_id}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border border-dashed border-border p-3">
                  <div className="mb-2 text-xs text-muted-foreground">
                    Or add a new patient
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="rounded-lg"
                    />
                    <Input
                      placeholder="Phone"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="rounded-lg w-32"
                    />
                    <Button
                      size="sm"
                      onClick={createPatient}
                      disabled={creatingPatient || !newName.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>Doctor</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger className="rounded-lg">
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

          <div className="space-y-2">
            <Label>Today's available slot</Label>
            {loadingSlots ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : slotResult.reason === "no-schedule" ||
              slotResult.reason === "inactive" ? (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                No schedule today. Set up under Settings → Doctor Schedule.
              </div>
            ) : slotResult.reason === "exception" ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                Doctor not available today.
              </div>
            ) : slotResult.slots.filter((s) => s.available).length === 0 ? (
              <p className="text-xs text-muted-foreground">No free slots left today.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {slotResult.slots.map((s) => {
                  const disabled = !s.available;
                  const selected = time === s.time;
                  return (
                    <button
                      key={s.time}
                      type="button"
                      disabled={disabled}
                      onClick={() => setTime(s.time)}
                      className={`rounded-md border px-2 py-1 text-xs font-mono transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : disabled
                            ? "border-border bg-muted text-muted-foreground/60 cursor-not-allowed line-through"
                            : "border-border bg-background hover:border-primary hover:text-primary"
                      }`}
                    >
                      {s.time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Chief complaint"
              className="rounded-lg"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !patient || !doctorId || !time}
          >
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Add to Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
