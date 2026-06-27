import { useEffect, useState, useCallback } from "react";
import MainShell from "@/components/layout/MainShell";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PatientLink from "@/components/PatientLink";
import { MessageCircle, CheckCircle2, AlertCircle, Clock, HeartHandshake } from "lucide-react";
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
  care_call_due_date: string | null;
  patient: { id: string; name: string; phone: string | null } | null;
  doctor: { name: string | null } | null;
};

export default function CareCallPage() {
  const { profile } = useAuth();
  const { clinic } = useClinic();
  const clinicId = profile?.clinic_id;
  const clinicName = clinic?.name ?? "our clinic";
  const [rows, setRows] = useState<CareCallRow[]>([]);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [completedToday, setCompletedToday] = useState(0);
  const today = format(new Date(), "yyyy-MM-dd");

  const load = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await (supabase as any)
      .from("appointments")
      .select("id, patient_id, appointment_date, care_call_due_date, patients(id, name, phone), doctors(name)")
      .eq("clinic_id", clinicId)
      .eq("care_call_required", true)
      .eq("care_call_done", false)
      .order("care_call_due_date", { ascending: true });

    const list = (data ?? []).map((r: any) => ({
      ...r,
      patient: Array.isArray(r.patients) ? r.patients[0] : r.patients,
      doctor: Array.isArray(r.doctors) ? r.doctors[0] : r.doctors,
    })) as CareCallRow[];
    setRows(list);

    const restored: Record<string, string> = {};
    list.forEach((r) => {
      const v = formStorage.read<string>(`care_call_note_${r.id}`, "");
      if (v) restored[r.id] = v;
    });
    if (Object.keys(restored).length) setNoteMap((m) => ({ ...restored, ...m }));

    // Completed today
    const { count } = await (supabase as any)
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("care_call_done", true)
      .gte("updated_at", today + "T00:00:00")
      .lte("updated_at", today + "T23:59:59");
    setCompletedToday(count ?? 0);
  }, [clinicId, today]);

  useEffect(() => { load(); }, [load]);

  const setNote = (id: string, v: string) => {
    setNoteMap((m) => ({ ...m, [id]: v }));
    if (v) formStorage.write(`care_call_note_${id}`, v);
    else formStorage.clear(`care_call_note_${id}`);
  };

  const overdue = rows.filter((r) => (r.care_call_due_date ?? "") < today);
  const upcoming = rows.filter((r) => (r.care_call_due_date ?? "") >= today);

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
    const note = noteMap[r.id]?.trim();
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

  const renderRow = (r: CareCallRow) => {
    const apptDate = new Date(r.appointment_date);
    const daysSince = differenceInCalendarDays(new Date(), apptDate);
    return (
      <li key={r.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>Visited {format(apptDate, "dd MMM")}</span>
            <span>· {r.doctor?.name ?? "Doctor"}</span>
            <span>· {daysSince}d ago</span>
            {r.care_call_due_date && (
              <span>· Due {format(new Date(r.care_call_due_date), "dd MMM")}</span>
            )}
          </div>
          <Textarea
            value={noteMap[r.id] ?? ""}
            onChange={(e) => setNote(r.id, e.target.value)}
            placeholder="Add care call note..."
            rows={1}
            className="min-h-[36px] text-sm"
          />
        </div>
        <div className="sm:self-center">
          <Button size="sm" onClick={() => markCalled(r)}>
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Mark Called
          </Button>
        </div>
      </li>
    );
  };

  return (
    <MainShell title="Care Call">
      {!clinicId ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading clinic...</div>
      ) : (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatBox icon={<AlertCircle className="h-4 w-4 text-red-600" />} label="Overdue" value={overdue.length} tone="red" />
            <StatBox icon={<Clock className="h-4 w-4 text-amber-600" />} label="Due" value={upcoming.length} tone="amber" />
            <StatBox icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} label="Completed Today" value={completedToday} tone="green" />
          </div>

          {rows.length === 0 && (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              <HeartHandshake className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
              No care calls pending. 🎉
            </div>
          )}

          {overdue.length > 0 && (
            <section className="rounded-2xl border bg-card shadow-card overflow-hidden">
              <header className="flex items-center justify-between border-b bg-red-50 px-4 py-3">
                <h2 className="font-display text-sm font-semibold text-red-900">
                  Overdue
                  <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">{overdue.length}</span>
                </h2>
              </header>
              <ul className="divide-y">{overdue.map(renderRow)}</ul>
            </section>
          )}

          {upcoming.length > 0 && (
            <section className="rounded-2xl border bg-card shadow-card overflow-hidden">
              <header className="flex items-center justify-between border-b bg-amber-50 px-4 py-3">
                <h2 className="font-display text-sm font-semibold text-amber-900">
                  Due Today &amp; Upcoming
                  <span className="ml-2 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">{upcoming.length}</span>
                </h2>
              </header>
              <ul className="divide-y">{upcoming.map(renderRow)}</ul>
            </section>
          )}
        </div>
      )}
    </MainShell>
  );
}

function StatBox({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "red" | "amber" | "green" }) {
  const toneCls = tone === "red" ? "bg-red-50" : tone === "amber" ? "bg-amber-50" : "bg-green-50";
  return (
    <div className={cn("rounded-xl border p-3", toneCls)}>
      <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
        {icon}{label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
