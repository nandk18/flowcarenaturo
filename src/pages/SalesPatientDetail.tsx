import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  MessageCircle,
  CalendarPlus,
  Pencil,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LeadForm } from "./Sales";

type LeadStatus = "attempt1" | "attempt2" | "attempt3" | "closed" | "current";

type Patient = {
  id: string;
  clinic_id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  lead_status: LeadStatus | null;
  lead_source: string | null;
  call_due_date: string | null;
  sla_breach_days: number | null;
  created_at: string | null;
};

type Note = {
  id: string;
  note: string;
  created_at: string;
  created_by: string | null;
  author_name?: string | null;
};

type AppointmentRow = {
  id: string;
  appointment_date: string;
  appointment_time: string | null;
};

const STATUS_STYLES: Record<LeadStatus, string> = {
  attempt1: "bg-yellow-100 text-yellow-800 border-yellow-200",
  attempt2: "bg-orange-100 text-orange-800 border-orange-200",
  attempt3: "bg-red-100 text-red-800 border-red-200",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
  current: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "attempt1", label: "Attempt 1" },
  { value: "attempt2", label: "Attempt 2" },
  { value: "attempt3", label: "Attempt 3" },
  { value: "current", label: "Current" },
  { value: "closed", label: "Closed" },
];

function calcAge(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const age = new Date(diff).getUTCFullYear() - 1970;
  return age;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default function SalesPatientDetail() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [addingNote, setAddingNote] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const loadPatient = async () => {
    if (!patientId) return;
    const { data } = await supabase.from("patients").select("*").eq("id", patientId).single();
    if (data) setPatient(data as Patient);
  };

  const loadNotes = async () => {
    if (!patientId) return;
    const { data } = await supabase
      .from("contact_notes")
      .select("id, note, created_at, created_by")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Note[];
    const authorIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean))) as string[];
    if (authorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      rows.forEach((r) => { r.author_name = r.created_by ? map.get(r.created_by) ?? null : null; });
    }
    setNotes(rows);
  };

  const loadAppointments = async () => {
    if (!patientId) return;
    const { data } = await supabase
      .from("appointments")
      .select("id, appointment_date, appointment_time")
      .eq("patient_id", patientId)
      .order("appointment_date", { ascending: false });
    setAppointments((data ?? []) as AppointmentRow[]);
  };

  useEffect(() => {
    loadPatient();
    loadNotes();
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const apptStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const past = appointments.filter((a) => a.appointment_date < today);
    const upcoming = appointments.filter((a) => a.appointment_date >= today);
    return {
      total: appointments.length,
      last: past.length ? past[0].appointment_date : null,
      next: upcoming.length ? upcoming[upcoming.length - 1].appointment_date : null,
    };
  }, [appointments]);

  const saveNote = async () => {
    if (!newNote.trim() || !patient) return;
    setSaving(true);
    const { error } = await supabase.from("contact_notes").insert({
      patient_id: patient.id,
      clinic_id: patient.clinic_id,
      note: newNote.trim(),
      created_by: profile?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setNewNote("");
    setAddingNote(false);
    toast.success("Note added");
    loadNotes();
  };

  const updateStatus = async (value: LeadStatus) => {
    if (!patient) return;
    setStatusSaving(true);
    const { error } = await supabase
      .from("patients")
      .update({ lead_status: value })
      .eq("id", patient.id);
    setStatusSaving(false);
    if (error) { toast.error(error.message); return; }
    setPatient({ ...patient, lead_status: value });
    toast.success("Status updated");
  };

  if (!patient) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TopBar />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const phoneDigits = patient.phone ? patient.phone.replace(/[^\d]/g, "") : "";
  const age = calcAge(patient.dob);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar />

      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sales")} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-2xl font-semibold">{patient.name}</h1>
          {patient.lead_status && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                STATUS_STYLES[patient.lead_status],
              )}
            >
              {patient.lead_status}
            </span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {patient.phone && (
              <Button asChild className="bg-green-600 hover:bg-green-700 text-white">
                <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                </a>
              </Button>
            )}
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => navigate(`/consult/appointments/new?patient_id=${patient.id}`)}
            >
              <CalendarPlus className="mr-1.5 h-4 w-4" /> Add Appointment
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit Patient
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-10">
          {/* LEFT COLUMN */}
          <div className="space-y-6 lg:col-span-3">
            {/* Patient Details */}
            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <h2 className="font-display text-base font-semibold">Patient Details</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <Field label="Full Name" value={patient.name} />
                <Field
                  label="Date of Birth"
                  value={patient.dob ? `${fmtDate(patient.dob)}${age !== null ? ` (${age} yrs)` : ""}` : "—"}
                />
                <Field label="Gender" value={patient.gender ?? "—"} />
                <Field label="Blood Group" value={patient.blood_group ?? "—"} />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Lead Status</dt>
                  <dd className="mt-1">
                    <Select
                      value={patient.lead_status ?? undefined}
                      onValueChange={(v) => updateStatus(v as LeadStatus)}
                      disabled={statusSaving}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </dd>
                </div>
                <Field label="Lead Source" value={patient.lead_source ?? "—"} />
                <Field label="Added On" value={fmtDate(patient.created_at)} />
              </dl>
            </section>

            {/* Contact Details */}
            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <h2 className="font-display text-base font-semibold">Contact Details</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Phone</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{patient.phone ?? "—"}</span>
                    {patient.phone && (
                      <a
                        href={`https://wa.me/${phoneDigits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-green-600 hover:underline text-xs"
                      >
                        <MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{patient.email ?? "—"}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Address</dt>
                  <dd className="mt-1 flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    <span className="whitespace-pre-wrap">{patient.address ?? "—"}</span>
                  </dd>
                </div>
              </dl>
            </section>

            {/* Emergency Contact */}
            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <h2 className="font-display text-base font-semibold">Emergency Contact</h2>
              {patient.emergency_contact_name || patient.emergency_contact_phone || patient.emergency_contact_relation ? (
                <dl className="mt-4 space-y-3 text-sm">
                  <Field label="Name" value={patient.emergency_contact_name ?? "—"} />
                  <Field label="Phone" value={patient.emergency_contact_phone ?? "—"} />
                  <Field label="Relation" value={patient.emergency_contact_relation ?? "—"} />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Not provided</p>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6 lg:col-span-7">
            {/* Appointments Overview */}
            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <h2 className="font-display text-base font-semibold">Appointments Overview</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatBox label="Total Appointments" value={String(apptStats.total)} />
                <StatBox label="Last Appointment" value={apptStats.last ? fmtDate(apptStats.last) : "None"} />
                <StatBox label="Next Appointment" value={apptStats.next ? fmtDate(apptStats.next) : "None"} />
              </div>
            </section>

            {/* Contact Notes */}
            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Contact Notes</h2>
                {!addingNote && (
                  <Button size="sm" onClick={() => setAddingNote(true)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Add Note
                  </Button>
                )}
              </div>

              {addingNote && (
                <div className="mt-4 space-y-2 rounded-lg border bg-background p-3">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Write a follow-up note..."
                    rows={3}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setAddingNote(false); setNewNote(""); }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveNote} disabled={saving || !newNote.trim()}>
                      {saving ? "Saving..." : "Save Note"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-3">
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes yet</p>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="rounded-lg border bg-background p-3">
                      <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {n.author_name ?? "Unknown"} · {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
          </DialogHeader>
          <LeadForm
            clinicId={patient.clinic_id}
            initial={patient as any}
            onSaved={(p) => {
              setEditOpen(false);
              setPatient(p as Patient);
              loadPatient();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
