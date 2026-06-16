import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Calendar, ChevronDown, ArrowRight, Clock } from "lucide-react";
import { formatDoctorName } from "@/lib/utils";
import CheckInModal, { type CheckInData } from "@/components/queue/CheckInModal";
import { format } from "date-fns";

import PatientLink from "@/components/PatientLink";

type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_time: string;
  status: string;
  reason: string | null;
  patient?: { id: string; name: string; healthcare_id: string | null };
  doctor?: { name: string };
};

export default function TodayAppointmentsWidget() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [converting, setConverting] = useState<string | null>(null);
  const [checkInFor, setCheckInFor] = useState<Appointment | null>(null);

  const fetchToday = async () => {
    if (!profile?.clinic_id) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await (supabase as any)
      .from("appointments")
      .select("id, clinic_id, patient_id, doctor_id, appointment_time, status, reason, patients(name, healthcare_id), doctors(name)")
      .eq("clinic_id", profile.clinic_id)
      .eq("appointment_date", today)
      .in("status", ["scheduled", "confirmed"])
      .order("appointment_time");
    if (data) {
      setAppointments(data.map((a: any) => ({
        ...a,
        patient: Array.isArray(a.patients) ? a.patients[0] : a.patients,
        doctor: Array.isArray(a.doctors) ? a.doctors[0] : a.doctors,
      })));
    }
  };

  useEffect(() => { fetchToday(); }, [profile?.clinic_id]);

  const performMoveToQueue = async (appt: Appointment, checkIn: CheckInData | null) => {
    if (!profile?.clinic_id) return;
    setConverting(appt.id);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: lastVisit } = await supabase.from("visits")
        .select("token_number").eq("clinic_id", profile.clinic_id)
        .eq("visit_date", today).order("token_number", { ascending: false }).limit(1).single();
      const nextToken = (lastVisit?.token_number || 0) + 1;

      const visitPayload: any = {
        clinic_id: profile.clinic_id,
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        token_number: nextToken,
        chief_complaint: (checkIn?.chief_complaint || appt.reason) || null,
        status: "waiting",
        visit_date: today,
      };
      if (checkIn) {
        visitPayload.lifestyle = checkIn.lifestyle;
        visitPayload.height_cm = checkIn.height_cm;
        visitPayload.weight_kg = checkIn.weight_kg;
        visitPayload.captured_at_reception = true;
      }
      const { error } = await supabase.from("visits").insert(visitPayload);
      if (error) throw error;

      await (supabase as any).from("appointments").update({ status: "completed" } as any).eq("id", appt.id);
      toast.success(`${appt.patient?.name} added to queue as #${nextToken}`);
      fetchToday();
    } catch (err: any) { toast.error(err.message); }
    finally { setConverting(null); setCheckInFor(null); }
  };

  if (appointments.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Card className="shadow-card mb-4 cursor-pointer hover:shadow-elevated transition-shadow">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  📅 {appointments.length} appointment{appointments.length !== 1 ? "s" : ""} today
                </p>
                <p className="text-xs text-muted-foreground">Click to expand</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 mb-4">
          {appointments.map(appt => (
            <Card key={appt.id} className="shadow-card">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="font-mono text-xs font-bold text-primary">{appt.appointment_time.substring(0, 5)}</span>
                  <span className="text-sm font-medium truncate">{appt.patient?.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{formatDoctorName(appt.doctor?.name)}</span>
                  <Badge variant="outline" className="text-[10px] bg-info/10 text-info border-info/30 flex-shrink-0">Appt</Badge>
                </div>
                <Button size="sm" className="text-xs flex-shrink-0" onClick={() => setCheckInFor(appt)} disabled={converting === appt.id}>
                  <ArrowRight className="mr-1 h-3 w-3" /> To Queue
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CollapsibleContent>
      <CheckInModal
        open={!!checkInFor}
        patientName={checkInFor?.patient?.name ?? ""}
        appointmentTime={checkInFor?.appointment_time?.substring(0, 5)}
        onClose={() => setCheckInFor(null)}
        onConfirm={async (data) => { if (checkInFor) await performMoveToQueue(checkInFor, data); }}
      />
    </Collapsible>
  );
}
