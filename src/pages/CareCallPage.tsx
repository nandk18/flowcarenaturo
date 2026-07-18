import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PatientLink from "@/components/PatientLink";
import { MessageCircle, HeartHandshake, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { formStorage } from "@/hooks/usePersistedForm";
import { getProfileId } from "@/utils/getProfileId";
import { buildMessage } from "@/lib/messageTemplates";
import { openWhatsApp } from "@/lib/whatsapp";

type CareCallRow = {
  id: string;
  patient_id: string;
  appointment_date: string;
  appointment_time: string | null;
  care_call_due_date: string | null;
  patient: { id: string; name: string; phone: string | null } | null;
  doctor: { name: string | null } | null;
};

export default function CareCallPage() {
  const { profile } = useAuth();
  const { clinic } = useClinic();
  const clinicId = profile?.clinic_id;
  const clinicName = clinic?.name ?? "our clinic";
  const today = format(new Date(), "yyyy-MM-dd");
  const [rows, setRows] = useState<CareCallRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await (supabase as any)
      .from("appointments")
      .select("id, patient_id, appointment_date, appointment_time, care_call_due_date, patients(id, name, phone), doctors(name)")
      .eq("clinic_id", clinicId)
      .eq("care_call_required", true)
      .eq("care_call_done", false)
      .order("care_call_due_date", { ascending: true });
    const mapped = (data ?? []).map((r: any) => ({
      ...r,
      patient: Array.isArray(r.patients) ? r.patients[0] : r.patients,
      doctor: Array.isArray(r.doctors) ? r.doctors[0] : r.doctors,
    })) as CareCallRow[];
    setRows(mapped);
    const restored: Record<string, string> = {};
    mapped.forEach((r) => {
      const v = formStorage.read<string>(`care_call_note_${r.id}`, "");
      if (v) restored[r.id] = v;
    });
    if (Object.keys(restored).length) setNotes((m) => ({ ...restored, ...m }));
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const setNote = (id: string, v: string) => {
    setNotes((m) => ({ ...m, [id]: v }));
    if (v) formStorage.write(`care_call_note_${id}`, v);
    else formStorage.clear(`care_call_note_${id}`);
  };

  const sendWhatsApp = async (r: CareCallRow) => {
    if (!clinicId || !r.patient?.phone) return;
    const msg = await buildMessage(clinicId, "care_call", {
      patient_name: r.patient.name,
      clinic_name: clinicName,
    });
    openWhatsApp(r.patient.phone, msg);
  };

  const markCalled = async (r: CareCallRow) => {
    if (!clinicId) return;
    const userId = await getProfileId();
    const note = notes[r.id]?.trim();
    if (note) {
      await supabase.from("contact_notes").insert({
        patient_id: r.patient_id,
        clinic_id: clinicId,
        note: `Care call: ${note}`,
        created_by: userId,
      });
    }
    const { error } = await (supabase as any)
      .from("appointments")
      .update({ care_call_done: true })
      .eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    formStorage.clear(`care_call_note_${r.id}`);
    toast.success("Care call logged");
    load();
  };

  return (
    <DashboardLayout title="Care Call">
      {!clinicId ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading clinic...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <HeartHandshake className="mx-auto h-10 w-10 text-amber-500" />
          <p className="mt-3 font-display text-sm font-semibold">No care calls pending</p>
          <p className="mt-1 text-xs text-muted-foreground">First-visit follow-ups will appear here automatically.</p>
        </div>
      ) : (
        <section className="rounded-2xl border bg-card shadow-card overflow-hidden">
          <header className="flex items-center justify-between border-b bg-amber-50 px-4 py-3">
            <h2 className="font-display text-sm font-semibold text-amber-900 flex items-center gap-2">
              <HeartHandshake className="h-4 w-4" />
              Care Call
              <span className="ml-2 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">{rows.length}</span>
            </h2>
            <span className="text-xs text-amber-800">First-visit follow-ups</span>
          </header>
          <ul className="divide-y">
            {rows.map((r) => {
              const apptDate = new Date(r.appointment_date);
              const daysSince = differenceInCalendarDays(new Date(), apptDate);
              const overdue = (r.care_call_due_date ?? "") < today;
              return (
                <li key={r.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("text-[10px]", overdue ? "bg-red-100 text-red-700 border-red-200" : "bg-amber-100 text-amber-700 border-amber-200")}>
                        {overdue ? "Overdue" : "Care Call"}
                      </Badge>
                      {r.patient && (
                        <PatientLink patientId={r.patient.id} className="text-sm font-semibold">
                          {r.patient.name}
                        </PatientLink>
                      )}
                      {r.patient?.phone && (
                        <>
                          <span className="text-xs text-muted-foreground">· {r.patient.phone}</span>
                          <button
                            type="button"
                            onClick={() => sendWhatsApp(r)}
                            className="inline-flex items-center text-green-600 text-xs hover:underline"
                            aria-label="Send WhatsApp care call"
                          >
                            <MessageCircle className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Visit: {format(apptDate, "dd MMM yyyy")} · {daysSince}d ago
                      {r.doctor?.name && <> · {r.doctor.name}</>}
                      {r.care_call_due_date && <> · Due {format(new Date(r.care_call_due_date), "dd MMM")}</>}
                    </div>
                    <Textarea
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNote(r.id, e.target.value)}
                      placeholder="Add care call note…"
                      rows={1}
                      className="min-h-[36px] text-sm"
                    />
                  </div>
                  <div className="sm:self-center">
                    <Button size="sm" onClick={() => markCalled(r)}>Mark Called</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </DashboardLayout>
  );
}
