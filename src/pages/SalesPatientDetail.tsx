import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageCircle, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Patient = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  lead_status: string | null;
  call_due_date: string | null;
  sla_breach_days: number | null;
  clinic_id: string;
};

type Note = { id: string; note: string; created_at: string };

export default function SalesPatientDetail() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!patientId) return;
    const [p, n] = await Promise.all([
      supabase.from("patients").select("*").eq("id", patientId).single(),
      supabase.from("contact_notes").select("id, note, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }),
    ]);
    if (p.data) setPatient(p.data as Patient);
    if (n.data) setNotes(n.data as Note[]);
  };

  useEffect(() => { load(); }, [patientId]);

  const addNote = async () => {
    if (!newNote.trim() || !patient) return;
    setSaving(true);
    const { error } = await supabase.from("contact_notes").insert({
      patient_id: patient.id,
      clinic_id: patient.clinic_id,
      note: newNote.trim(),
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setNewNote("");
    toast.success("Note added");
    load();
  };

  if (!patient) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar />
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sales")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to leads
        </Button>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 space-y-6">
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold">{patient.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {patient.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</span>}
                {patient.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{patient.email}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {patient.lead_status && <Badge variant="secondary">{patient.lead_status}</Badge>}
              {patient.phone && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://wa.me/${patient.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-1.5 h-4 w-4 text-green-600" /> WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Field label="DOB" value={patient.dob} />
            <Field label="Gender" value={patient.gender} />
            <Field label="Blood Group" value={patient.blood_group} />
            <Field label="Call Due" value={patient.call_due_date} />
            <Field label="SLA Breach" value={patient.sla_breach_days ? `${patient.sla_breach_days}d` : "—"} />
            <Field label="Emergency" value={patient.emergency_contact_name} />
            <Field label="Em. Phone" value={patient.emergency_contact_phone} />
            <Field label="Relation" value={patient.emergency_contact_relation} />
          </div>

          {patient.address && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Address</p>
              <p className="text-sm">{patient.address}</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold">Contact notes</h2>
          <div className="mt-3 space-y-2">
            <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a follow-up note..." rows={3} />
            <div className="flex justify-end">
              <Button onClick={addNote} disabled={saving || !newNote.trim()}>Add note</Button>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet</p>
            ) : notes.map((n) => (
              <div key={n.id} className="rounded-lg border bg-background p-3">
                <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
