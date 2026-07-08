import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useUrlState } from "@/hooks/useUrlState";
import { formStorage } from "@/hooks/usePersistedForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PatientDocumentsCard from "@/components/patient/PatientDocumentsCard";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  MessageCircle,
  CalendarPlus,
  Pencil,
  Phone,
  Mail,
  MapPin,
  Search,
  FileText,
  Receipt,
  Calendar,
  User,
  Share2,
  Coffee,
  Cigarette,
  Wine,
  Moon,
  Utensils,
  ClipboardList,
  Scissors,
  Activity,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LeadForm } from "./Sales";
import PatientInvoicesTab from "@/components/billing/PatientInvoicesTab";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";
import PatientTreatmentTab from "@/components/patient/PatientTreatmentTab";
import { HeartPulse } from "lucide-react";
import PatientTodoCard from "@/components/patient/PatientTodoCard";
import EditVisitSheet from "@/components/doctor/EditVisitSheet";
import { openWhatsApp } from "@/lib/whatsapp";
import { buildMessage } from "@/lib/messageTemplates";
import { getProfileId } from "@/utils/getProfileId";
import { createShortLink } from "@/utils/createShortLink";

import CheckInModal, { type CheckInData } from "@/components/queue/CheckInModal";
import { ArrowRight, Play, Eye, X } from "lucide-react";
import CancelAppointmentModal from "@/components/appointments/CancelAppointmentModal";

import { Badge } from "@/components/ui/badge";

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
  convenient_time: string | null;
  food_habits: string | null;
  smoking: string | null;
  alcohol: string | null;
  sleep_hours: number | null;
  dinner_time: string | null;
  medication_history: string | null;
  past_surgery_details: string | null;
  allergies: any;
  chronic_conditions: any;
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
  status: string | null;
  reason: string | null;
  notes: string | null;
  doctor_id: string | null;
  doctor_name?: string | null;
  rescheduled_from: string | null;
  rescheduled_to: string | null;
  services_label?: string | null;
  is_treatment?: boolean;
  services?: { service_id: string; invoice_services: { id: string; name: string; service_type: string | null; amount: number | null } | null }[];
};

type VisitDetail = {
  id: string;
  visit_date: string | null;
  created_at: string;
  chief_complaint: string | null;
  vitals: any;
  status: string | null;
  doctor_id: string | null;
  doctor_name?: string | null;
  clinical_notes: {
    id: string;
    soap_notes: any;
    raw_transcript: string | null;
    audio_url: string | null;
    created_at: string;
  }[];
  prescriptions: {
    id: string;
    medications: any;
    investigations: any;
    notes: string | null;
    follow_up_date: string | null;
    pdf_url: string | null;
  }[];
  documents: { id: string; file_name: string | null; file_url: string | null; document_type: string | null }[];
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: string;
  line_items: any;
  notes: string | null;
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

const INVOICE_STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  unpaid: "bg-red-100 text-red-700 border-red-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

const APPT_STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-teal-100 text-teal-700 border-teal-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  "no-show": "bg-red-100 text-red-700 border-red-200",
};

function calcAge(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return new Date(diff).getUTCFullYear() - 1970;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function fmtDateShort(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    n || 0,
  );
}

function visitPreview(v: VisitDetail): string {
  if (v.chief_complaint) return v.chief_complaint.slice(0, 80);
  const cn = v.clinical_notes?.[0];
  if (cn?.soap_notes && typeof cn.soap_notes === "object") {
    const s = cn.soap_notes as any;
    const txt = s.subjective || s.assessment || s.plan || s.objective || "";
    if (txt) return String(txt).slice(0, 80);
  }
  if (cn?.raw_transcript) return cn.raw_transcript.slice(0, 80);
  return "Consultation";
}

function fmtVitals(vitals: any): { label: string; value: string }[] {
  if (!vitals || typeof vitals !== "object") return [];
  const map: Record<string, string> = {
    bp: "BP",
    blood_pressure: "BP",
    pulse: "Pulse",
    heart_rate: "Pulse",
    temp: "Temp",
    temperature: "Temp",
    weight: "Weight",
    height: "Height",
    spo2: "SpO₂",
    oxygen_saturation: "SpO₂",
    respiratory_rate: "RR",
    rr: "RR",
  };
  return Object.entries(vitals)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => ({ label: map[k.toLowerCase()] ?? k, value: String(v) }));
}

export default function SalesPatientDetail() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const fromConsult = location.pathname.startsWith("/consult/");
  const backTo = "/patients";
  const [patient, setPatient] = useState<Patient | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState<VisitDetail[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [addingNote, setAddingNote] = useState(false);
  const [newNote, setNewNoteState] = useState("");
  const setNewNote = (v: string) => {
    setNewNoteState(v);
    if (patient?.id) {
      if (v) formStorage.write(`contact_note_${patient.id}`, v);
      else formStorage.clear(`contact_note_${patient.id}`);
    }
  };
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [activeTab, setActiveTab] = useUrlState("tab", "general");
  const { enabled: treatmentEnabled } = useTreatmentEnabled();

  const handleSendFormLink = async () => {
    if (!patient) return;
    setSendingLink(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, "");
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("patient_form_tokens").insert({
        clinic_id: patient.clinic_id,
        patient_id: patient.id,
        token,
        expires_at: expires.toISOString(),
        is_active: true,
        created_by: user?.id,
      } as any);
      if (error) throw error;
      const rawUrl = `${window.location.origin}/patient-form/${token}`;
      const url = await createShortLink(rawUrl, patient.clinic_id, "patient_form", expires);

      const { data: clinicRow } = await supabase
        .from("clinics").select("name").eq("id", patient.clinic_id).maybeSingle();
      const msg = await buildMessage(patient.clinic_id, "patient_form_link", {
        patient_name: patient.name,
        clinic_name: clinicRow?.name ?? "our clinic",
        form_link: url,
      });
      if (patient.phone) {
        openWhatsApp(patient.phone, msg);
        toast.success("WhatsApp opened with form link");
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Form link copied to clipboard (no phone on file)");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate form link");
    } finally {
      setSendingLink(false);
    }
  };

  const loadPatient = async () => {
    if (!patientId) return;
    const { data } = await supabase.from("patients").select("*").eq("id", patientId).single();
    if (data) {
      setPatient(data as Patient);
      const draft = formStorage.read<string>(`contact_note_${data.id}`, "");
      if (draft) {
        setNewNoteState(draft);
        setAddingNote(true);
      }
    }
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
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", authorIds);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      rows.forEach((r) => {
        r.author_name = r.created_by ? (map.get(r.created_by) ?? null) : null;
      });
    }
    setNotes(rows);
  };

  const loadAppointments = async () => {
    if (!patientId) return;
    const { data } = await supabase
      .from("appointments")
      .select("id, appointment_date, appointment_time, status, reason, notes, doctor_id, rescheduled_from, rescheduled_to, appointment_services(service_id, invoice_services(id, name, service_type, amount))")
      .eq("patient_id", patientId)
      .order("appointment_date", { ascending: false });
    const rows = (data ?? []).map((r: any) => {
      const svcs = (r.appointment_services ?? []).map((s: any) => ({
        service_id: s.service_id,
        invoice_services: s.invoice_services ?? null,
      }));
      const svcInfo = svcs.map((s: any) => s.invoice_services).filter(Boolean);
      const label = svcInfo.length ? svcInfo.map((s: any) => s.name).join(", ") : null;
      const isTreatment =
        svcInfo.length > 0 &&
        svcInfo.every((s: any) => (s?.service_type ?? "consultation") === "treatment");
      return { ...r, services_label: label, is_treatment: isTreatment, services: svcs } as AppointmentRow;
    });
    const docIds = Array.from(new Set(rows.map((r) => r.doctor_id).filter(Boolean))) as string[];
    if (docIds.length) {
      const { data: docs } = await supabase.from("doctors").select("id, name").in("id", docIds);
      const map = new Map((docs ?? []).map((d: any) => [d.id, d.name]));
      rows.forEach((r) => {
        r.doctor_name = r.doctor_id ? (map.get(r.doctor_id) ?? null) : null;
      });
    }
    setAppointments(rows);
  };

  const loadClinicalNotes = async () => {
    if (!patientId) return;
    const { data: visits } = await supabase
      .from("visits")
      .select(
        `
        id, visit_date, created_at, chief_complaint, vitals, status, doctor_id,
        clinical_notes(id, soap_notes, raw_transcript, audio_url, created_at),
        prescriptions(id, medications, investigations, notes, follow_up_date, pdf_url)
      `,
      )
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false, nullsFirst: false });
    const rows = (visits ?? []) as any[];
    const docIds = Array.from(new Set(rows.map((r) => r.doctor_id).filter(Boolean))) as string[];
    let docMap = new Map<string, string>();
    if (docIds.length) {
      const { data: docs } = await supabase.from("doctors").select("id, name").in("id", docIds);
      docMap = new Map((docs ?? []).map((d: any) => [d.id, d.name]));
    }
    // Load patient-level documents and group them by visit_id when present.
    const { data: docsRows } = await supabase
      .from("patient_documents")
      .select("id, file_name, file_url, document_type, visit_id")
      .eq("patient_id", patientId);
    const docsByVisit: Record<string, any[]> = {};
    (docsRows ?? []).forEach((d: any) => {
      const k = d.visit_id ?? "_patient";
      (docsByVisit[k] ||= []).push(d);
    });
    const enriched: VisitDetail[] = rows.map((r: any) => ({
      id: r.id,
      visit_date: r.visit_date,
      created_at: r.created_at,
      chief_complaint: r.chief_complaint,
      vitals: r.vitals,
      status: r.status,
      doctor_id: r.doctor_id,
      doctor_name: r.doctor_id ? (docMap.get(r.doctor_id) ?? null) : null,
      clinical_notes: r.clinical_notes ?? [],
      prescriptions: r.prescriptions ?? [],
      documents: docsByVisit[r.id] ?? [],
    }));
    setClinicalNotes(enriched);
  };

  const loadInvoices = async () => {
    if (!patientId) return;
    const { data } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, invoice_date, total_amount, paid_amount, outstanding_amount, status, line_items, notes",
      )
      .eq("patient_id", patientId)
      .order("invoice_date", { ascending: false });
    setInvoices((data ?? []) as InvoiceRow[]);
  };

  useEffect(() => {
    loadPatient();
    loadNotes();
    loadAppointments();
    loadClinicalNotes();
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const apptStats = useMemo(() => {
    const list = Array.isArray(appointments) ? appointments : [];
    const today = new Date().toISOString().slice(0, 10);
    const past = list.filter((a) => a?.appointment_date && a.appointment_date < today);
    const upcoming = list.filter((a) => a?.appointment_date && a.appointment_date >= today);
    const invList = Array.isArray(invoices) ? invoices : [];
    const pendingPayment = invList
      .filter((i) => i?.status === "unpaid" || i?.status === "partial")
      .reduce((sum, i) => sum + Number(i?.outstanding_amount || 0), 0);
    return {
      total: list.length,
      last: past.length ? past[0].appointment_date : null,
      next: upcoming.length ? upcoming[upcoming.length - 1].appointment_date : null,
      pendingPayment,
    };
  }, [appointments, invoices]);

  const saveNote = async () => {
    if (!newNote.trim() || !patient) return;
    if (!profile?.id || !patient.clinic_id) {
      toast.error("Session not ready. Please refresh and try again.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("contact_notes").insert({
        patient_id: patient.id,
        clinic_id: patient.clinic_id,
        note: newNote.trim(),
        created_by: profile.id,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setNewNote("");
      if (patient?.id) formStorage.clear(`contact_note_${patient.id}`);
      setAddingNote(false);
      toast.success("Note added");
      loadNotes();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (value: LeadStatus) => {
    if (!patient) return;
    setStatusSaving(true);
    try {
      const { error } = await supabase.from("patients").update({ lead_status: value }).eq("id", patient.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      setPatient({ ...patient, lead_status: value });
      toast.success("Status updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update status");
    } finally {
      setStatusSaving(false);
    }
  };

  if (!patient) {
    const loadingBody = (
      <div className="flex flex-1 items-center justify-center text-muted-foreground py-20">Loading...</div>
    );
    return <DashboardLayout>{loadingBody}</DashboardLayout>;
  }

  const phoneDigits = patient.phone ? patient.phone.replace(/[^\d]/g, "") : "";
  const age = calcAge(patient.dob);

  const content = (
    <>
      <div className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(backTo)} aria-label="Back">
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
              onClick={() => navigate(`/availability?patient=${patient.id}&book=1`)}
            >
              <CalendarPlus className="mr-1.5 h-4 w-4" /> Add Appointment
            </Button>
            <Button variant="outline" onClick={handleSendFormLink} disabled={sendingLink}>
              <Share2 className="mr-1.5 h-4 w-4" /> {sendingLink ? "Generating..." : "Send Form Link"}
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit Patient
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full max-w-2xl ${treatmentEnabled ? "grid-cols-5" : "grid-cols-4"}`}>
            <TabsTrigger value="general">
              <User className="mr-1.5 h-3.5 w-3.5" /> General
            </TabsTrigger>
            <TabsTrigger value="clinical">
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Clinical Notes
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <Receipt className="mr-1.5 h-3.5 w-3.5" /> Invoices
            </TabsTrigger>
            <TabsTrigger value="appointments">
              <Calendar className="mr-1.5 h-3.5 w-3.5" /> Appointments
            </TabsTrigger>
            {treatmentEnabled && (
              <TabsTrigger value="treatment">
                <HeartPulse className="mr-1.5 h-3.5 w-3.5" /> Treatment
              </TabsTrigger>
            )}
          </TabsList>

          {/* ===== GENERAL ===== */}
          <TabsContent value="general" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-10">
              <div className="space-y-6 lg:col-span-3">
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
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </dd>
                    </div>
                    <Field label="Lead Source" value={patient.lead_source ?? "—"} />
                    <Field label="Added On" value={fmtDate(patient.created_at)} />
                  </dl>
                </section>

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
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Convenient Time to Call</dt>
                      <dd className="mt-1 text-sm">{patient.convenient_time ?? "—"}</dd>
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

                <section className="rounded-2xl border bg-card p-5 shadow-card">
                  <h2 className="font-display text-base font-semibold">Emergency Contact</h2>
                  {patient.emergency_contact_name ||
                  patient.emergency_contact_phone ||
                  patient.emergency_contact_relation ? (
                    <dl className="mt-4 space-y-3 text-sm">
                      <Field label="Name" value={patient.emergency_contact_name ?? "—"} />
                      <Field label="Phone" value={patient.emergency_contact_phone ?? "—"} />
                      <Field label="Relation" value={patient.emergency_contact_relation ?? "—"} />
                    </dl>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">Not provided</p>
                  )}
                </section>

                <section className="rounded-2xl border bg-card p-5 shadow-card">
                  <h2 className="font-display text-base font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" /> Lifestyle & Habits
                  </h2>
                  {patient.food_habits ||
                  patient.smoking ||
                  patient.alcohol ||
                  patient.sleep_hours ||
                  patient.dinner_time ? (
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Utensils className="h-3.5 w-3.5 text-muted-foreground" />
                        <Field label="Diet" value={patient.food_habits ?? "—"} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Cigarette className="h-3.5 w-3.5 text-muted-foreground" />
                        <Field label="Smoking" value={patient.smoking ?? "—"} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Wine className="h-3.5 w-3.5 text-muted-foreground" />
                        <Field label="Alcohol" value={patient.alcohol ?? "—"} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                        <Field
                          label="Sleep (hrs)"
                          value={patient.sleep_hours != null ? String(patient.sleep_hours) : "—"}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Coffee className="h-3.5 w-3.5 text-muted-foreground" />
                        <Field label="Dinner Time" value={patient.dinner_time ?? "—"} />
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground italic">
                      No lifestyle info recorded. Use "Send Form Link" to ask the patient.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border bg-card p-5 shadow-card">
                  <h2 className="font-display text-base font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" /> Medical History
                  </h2>
                  {patient.medication_history ||
                  patient.past_surgery_details ||
                  (Array.isArray(patient.allergies) && patient.allergies.length) ||
                  (Array.isArray(patient.chronic_conditions) && patient.chronic_conditions.length) ? (
                    <dl className="mt-4 space-y-3 text-sm">
                      <Field label="Current Medications" value={patient.medication_history ?? "—"} />
                      <div className="flex items-start gap-2">
                        <Scissors className="mt-1 h-3.5 w-3.5 text-muted-foreground" />
                        <Field label="Past Surgeries" value={patient.past_surgery_details ?? "—"} />
                      </div>
                      <Field
                        label="Allergies"
                        value={
                          Array.isArray(patient.allergies) && patient.allergies.length
                            ? patient.allergies.join(", ")
                            : "—"
                        }
                      />
                      <Field
                        label="Chronic Conditions"
                        value={
                          Array.isArray(patient.chronic_conditions) && patient.chronic_conditions.length
                            ? patient.chronic_conditions.join(", ")
                            : "—"
                        }
                      />
                    </dl>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground italic">
                      No medical history recorded. Use "Send Form Link" to collect it.
                    </p>
                  )}
                </section>
              </div>

              <div className="space-y-6 lg:col-span-7">
                <section className="rounded-2xl border bg-card p-5 shadow-card">
                  <h2 className="font-display text-base font-semibold">Appointments Overview</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <StatBox label="Total Appointments" value={String(apptStats.total)} />
                    <StatBox label="Last Appointment" value={apptStats.last ? fmtDate(apptStats.last) : "None"} />
                    <StatBox label="Next Appointment" value={apptStats.next ? fmtDate(apptStats.next) : "None"} />
                    <StatBox
                      label="Pending Payment"
                      value={`₹${Number(apptStats.pendingPayment || 0).toLocaleString("en-IN")}`}
                      valueClassName={apptStats.pendingPayment > 0 ? "text-red-600" : "text-green-600"}
                    />
                  </div>
                </section>

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
                          onClick={() => {
                            setAddingNote(false);
                            setNewNote("");
                          }}
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

            <div className="mt-6">
              <PatientTodoCard patientId={patient.id} clinicId={patient.clinic_id} />
            </div>

            <div className="mt-6">
              <PatientDocumentsCard patientId={patient.id} clinicId={patient.clinic_id} />
            </div>
          </TabsContent>


          {/* ===== CLINICAL NOTES ===== */}
          <TabsContent value="clinical" className="mt-6">
            <ClinicalNotesTab
              patientName={patient.name}
              patientId={patient.id}
              treatmentEnabled={treatmentEnabled}
              notes={clinicalNotes}
              editable={fromConsult}
              onReload={loadClinicalNotes}
            />
          </TabsContent>

          {/* ===== INVOICES ===== */}
          <TabsContent value="invoices" className="mt-6">
            <PatientInvoicesTab patientId={patient.id} clinicId={patient.clinic_id} />
          </TabsContent>

          {/* ===== APPOINTMENTS ===== */}
          <TabsContent value="appointments" className="mt-6">
            <AppointmentsTab
              patientId={patient.id}
              clinicId={patient.clinic_id}
              patientName={patient.name}
              patientPhone={patient.phone}
              appointments={appointments}
              onAdd={() => navigate(`/availability?patient=${patient.id}&book=1`)}
              onChanged={loadAppointments}
            />
          </TabsContent>

          {treatmentEnabled && (
            <TabsContent value="treatment" className="mt-6">
              <PatientTreatmentTab patientId={patient.id} clinicId={patient.clinic_id} />
            </TabsContent>
          )}
        </Tabs>
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
    </>
  );

  return <DashboardLayout title={patient.name}>{content}</DashboardLayout>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function StatBox({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-display text-2xl font-semibold", valueClassName)}>{value}</p>
    </div>
  );
}

// ============ CLINICAL NOTES TAB ============

function ClinicalNotesTab({
  patientName,
  patientId,
  treatmentEnabled,
  notes,
  editable = false,
  onReload,
}: {
  patientName: string;
  patientId?: string;
  treatmentEnabled?: boolean;
  notes: VisitDetail[];
  editable?: boolean;
  onReload?: () => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const urlVisitId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("visit") : null;
  const [selectedId, setSelectedId] = useState<string | null>(urlVisitId ?? notes[0]?.id ?? null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (urlVisitId && notes.some((n) => n.id === urlVisitId)) {
      setSelectedId(urlVisitId);
    } else if (!selectedId && notes.length) {
      setSelectedId(notes[0].id);
    }
  }, [notes, urlVisitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((v) => {
      const dateStr = fmtDateShort(v.visit_date ?? v.created_at).toLowerCase();
      const txt =
        (v.chief_complaint ?? "") +
        " " +
        (v.doctor_name ?? "") +
        " " +
        v.clinical_notes.map((c) => (c.raw_transcript ?? "") + JSON.stringify(c.soap_notes ?? {})).join(" ");
      return dateStr.includes(q) || txt.toLowerCase().includes(q);
    });
  }, [notes, search]);

  const selected = notes.find((v) => v.id === selectedId) ?? null;
  const vitals = selected ? fmtVitals(selected.vitals) : [];
  const meds: any[] = selected
    ? selected.prescriptions.flatMap((p) => (Array.isArray(p.medications) ? p.medications : []))
    : [];
  const investigations: any[] = selected
    ? selected.prescriptions.flatMap((p) => (Array.isArray(p.investigations) ? p.investigations : []))
    : [];
  const rxNotes = selected?.prescriptions.map((p) => p.notes).filter(Boolean) ?? [];
  const followUps = selected?.prescriptions.map((p) => p.follow_up_date).filter(Boolean) ?? [];
  const rxPdfs = selected?.prescriptions.filter((p) => p.pdf_url) ?? [];

  const firstNote = selected?.clinical_notes?.[0];
  const firstRx = selected?.prescriptions?.[0];
  const editVisit = selected
    ? {
        id: selected.id,
        clinical_notes_id: firstNote?.id ?? null,
        soap_notes: firstNote?.soap_notes ?? {},
        prescription_id: firstRx?.id ?? null,
        medications: firstRx?.medications ?? [],
        follow_up_date: firstRx?.follow_up_date ?? null,
        prescription_notes: firstRx?.notes ?? null,
      }
    : null;

  const fmtSchedule = (m: any) => {
    const parts: string[] = [];
    if (m.morning) parts.push("M");
    if (m.afternoon) parts.push("A");
    if (m.evening) parts.push("E");
    if (m.night) parts.push("N");
    if (parts.length) return parts.join(" - ");
    return m.frequency ?? "—";
  };

  return (
    <div className="grid gap-4 lg:grid-cols-10">
      <aside className="lg:col-span-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-sm font-semibold">Visits</h3>
          </div>
          {treatmentEnabled && patientId && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => navigate(`/treatment/schedule?patient_id=${patientId}`)}
            >
              <Plus className="mr-1 h-3 w-3" /> New Plan
            </Button>
          )}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by date, doctor, content"
          className="mb-3"
        />
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">No consultations</p>
          ) : (
            filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition hover:bg-accent",
                  selectedId === v.id && "border-primary bg-accent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {fmtDateShort(v.visit_date ?? v.created_at)}
                  </span>
                  {v.status && <span className="text-[10px] uppercase text-muted-foreground">{v.status}</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{v.doctor_name ?? "Doctor"}</p>
                <p className="mt-1 text-sm line-clamp-2">{visitPreview(v)}</p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="lg:col-span-7 rounded-2xl border bg-card p-6 shadow-card">
        {!selected ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
            Select a visit to view full consultation
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between border-b pb-3 gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">{patientName}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtDateShort(selected.visit_date ?? selected.created_at)} ·{" "}
                  {new Date(selected.created_at).toLocaleTimeString()} · {selected.doctor_name ?? "Doctor"}
                </p>
              </div>
              {editable && editVisit && (firstNote || firstRx) && (
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>

            {selected.chief_complaint && (
              <div>
                <h4 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                  Chief Complaint
                </h4>
                <p className="text-sm whitespace-pre-wrap">{selected.chief_complaint}</p>
              </div>
            )}

            {vitals.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">Vitals</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {vitals.map((v) => (
                    <div key={v.label} className="rounded-md border bg-background px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{v.label}</p>
                      <p className="text-sm font-medium">{v.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.clinical_notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clinical notes recorded.</p>
            ) : (
              selected.clinical_notes.map((cn) => {
                const soap = cn.soap_notes as any;
                const templateName = soap?._template ?? null;
                const soapKeys =
                  soap && typeof soap === "object" ? Object.keys(soap).filter((k) => k !== "_template" && soap[k]) : [];
                return (
                  <div key={cn.id} className="space-y-3 rounded-lg border bg-background p-3">
                    {templateName && (
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Template: {templateName}
                      </p>
                    )}
                    {soapKeys.length > 0 ? (
                      soapKeys.map((k) => (
                        <div key={k}>
                          <h4 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                            {k.replace(/_/g, " ")}
                          </h4>
                          <p className="text-sm whitespace-pre-wrap">{String(soap[k])}</p>
                        </div>
                      ))
                    ) : cn.raw_transcript ? (
                      <div>
                        <h4 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                          Transcript
                        </h4>
                        <p className="text-sm whitespace-pre-wrap">{cn.raw_transcript}</p>
                      </div>
                    ) : null}
                    {cn.audio_url && <audio src={cn.audio_url} controls className="w-full" />}
                  </div>
                );
              })
            )}

            {meds.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                  Prescription
                </h4>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Dosage</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Instructions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {meds.map((m, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{m.name ?? m.medicine ?? "—"}</TableCell>
                          <TableCell className="text-sm">{m.dosage ?? m.dose ?? "—"}</TableCell>
                          <TableCell className="text-sm">{fmtSchedule(m)}</TableCell>
                          <TableCell className="text-sm">{m.duration ?? "—"}</TableCell>
                          <TableCell className="text-sm">{m.notes ?? m.instructions ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {rxNotes.length > 0 && (
                  <div className="mt-2">
                    <h5 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                      Special Instructions
                    </h5>
                    {rxNotes.map((n, i) => (
                      <p key={i} className="text-sm whitespace-pre-wrap">
                        {n}
                      </p>
                    ))}
                  </div>
                )}
                {followUps.length > 0 && (
                  <p className="mt-2 text-sm">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Follow-up: </span>
                    {followUps.map((d) => fmtDateShort(d as string)).join(", ")}
                  </p>
                )}
                {rxPdfs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rxPdfs.map((p) => (
                      <a
                        key={p.id}
                        href={p.pdf_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <FileText className="h-3.5 w-3.5" /> Prescription PDF
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {investigations.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                  Investigations
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  {investigations.map((inv, i) => (
                    <li key={i} className="text-sm">
                      {typeof inv === "string" ? inv : (inv.name ?? inv.test ?? JSON.stringify(inv))}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selected.documents.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                  Attached Files
                </h4>
                <ul className="space-y-1">
                  {selected.documents.map((d) => (
                    <li key={d.id}>
                      <a
                        href={d.file_url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {d.file_name ?? d.document_type ?? "Document"}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!editable && (
              <p className="text-[11px] text-muted-foreground border-t pt-3">
                Read-only view. Editing happens in Consult.
              </p>
            )}
          </div>
        )}
      </section>

      <EditVisitSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        visit={editVisit}
        onSaved={() => {
          setEditOpen(false);
          onReload?.();
        }}
      />
    </div>
  );
}

// ============ INVOICES TAB ============

function InvoicesTab({ patientName, invoices }: { patientName: string; invoices: InvoiceRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(invoices[0]?.id ?? null);

  useEffect(() => {
    if (!selectedId && invoices.length) setSelectedId(invoices[0].id);
  }, [invoices, selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (!q) return true;
      return (
        i.invoice_number.toLowerCase().includes(q) || i.invoice_date.includes(q) || i.status.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, statusFilter]);

  const selected = invoices.find((i) => i.id === selectedId) ?? null;
  const lineItems: any[] = Array.isArray(selected?.line_items) ? (selected!.line_items as any[]) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-10">
      <aside className="lg:col-span-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-sm font-semibold">Search & Filter</h3>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Number, date, status"
          className="mb-2"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="mb-3 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">No invoices</p>
          ) : (
            filtered.map((i) => (
              <button
                key={i.id}
                onClick={() => setSelectedId(i.id)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition hover:bg-accent",
                  selectedId === i.id && "border-primary bg-accent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{i.invoice_number}</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                      INVOICE_STATUS_STYLES[i.status] ?? INVOICE_STATUS_STYLES.unpaid,
                    )}
                  >
                    {i.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{fmtDateShort(i.invoice_date)}</p>
                <p className="mt-1 text-sm font-medium">{fmtCurrency(Number(i.total_amount))}</p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="lg:col-span-7 rounded-2xl border bg-card p-6 shadow-card">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Coming Soon — invoice actions (download, share, payment) will be configured later.
        </div>
        {!selected ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
            Select an invoice to view
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h2 className="font-display text-xl font-semibold">{patientName}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Invoice <span className="font-medium">{selected.invoice_number}</span> ·{" "}
                  {fmtDateShort(selected.invoice_date)}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase",
                  INVOICE_STATUS_STYLES[selected.status] ?? INVOICE_STATUS_STYLES.unpaid,
                )}
              >
                {selected.status}
              </span>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        No line items
                      </TableCell>
                    </TableRow>
                  ) : (
                    lineItems.map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm">{it.description ?? it.name ?? "Item"}</TableCell>
                        <TableCell className="text-sm text-right">{it.quantity ?? 1}</TableCell>
                        <TableCell className="text-sm text-right">
                          {fmtCurrency(Number(it.price ?? it.unit_price ?? 0))}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {fmtCurrency(Number(it.amount ?? (it.quantity ?? 1) * (it.price ?? it.unit_price ?? 0)))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-display text-lg font-semibold">{fmtCurrency(Number(selected.total_amount))}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="font-display text-lg font-semibold">{fmtCurrency(Number(selected.paid_amount))}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="font-display text-lg font-semibold">{fmtCurrency(Number(selected.outstanding_amount))}</p>
              </div>
            </div>

            {selected.notes && (
              <div>
                <h4 className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-1">Notes</h4>
                <p className="text-sm whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ============ APPOINTMENTS TAB ============

function AppointmentsTab({
  patientId,
  clinicId,
  patientName,
  patientPhone,
  appointments,
  onAdd,
  onChanged,
}: {
  patientId: string;
  clinicId: string;
  patientName: string;
  patientPhone: string | null;
  appointments: AppointmentRow[];
  onAdd: () => void;
  onChanged: () => void;
}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "upcoming" | "past" | "cancelled">("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [startAppt, setStartAppt] = useState<AppointmentRow | null>(null);
  const [cancelAppt, setCancelAppt] = useState<AppointmentRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const sorted = useMemo(() => {
    const todayList = appointments.filter((a) => a.appointment_date === today && a.status !== "cancelled");
    const upcoming = appointments
      .filter((a) => a.appointment_date > today && a.status !== "cancelled")
      .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
    const past = appointments
      .filter((a) => a.appointment_date < today && a.status !== "cancelled")
      .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));
    const cancelled = appointments.filter((a) => a.status === "cancelled");

    switch (filter) {
      case "upcoming":
        return [...todayList, ...upcoming];
      case "past":
        return past;
      case "cancelled":
        return cancelled;
      default:
        return [...todayList, ...upcoming, ...past, ...cancelled];
    }
  }, [appointments, filter, today]);

  useEffect(() => {
    setPage(1);
  }, [filter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const findVisit = async (apptDate: string) => {
    const { data } = await supabase
      .from("visits")
      .select("id, status")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .eq("visit_date", apptDate)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as { id: string; status: string } | null;
  };

  const startConsultation = async (a: AppointmentRow, prereq: CheckInData | null) => {
    if (!profile?.clinic_id) return;
    setBusyId(a.id);
    try {
      let visit = await findVisit(a.appointment_date);
      if (!visit) {
        const { data: last } = await supabase
          .from("visits")
          .select("token_number")
          .eq("clinic_id", clinicId)
          .eq("visit_date", a.appointment_date)
          .order("token_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextToken = ((last as any)?.token_number ?? 0) + 1;
        const payload: any = {
          clinic_id: clinicId,
          patient_id: patientId,
          doctor_id: a.doctor_id,
          token_number: nextToken,
          chief_complaint: prereq?.chief_complaint || a.reason || null,
          status: "in_progress",
          visit_date: a.appointment_date,
        };
        if (prereq) {
          payload.height_cm = prereq.height_cm;
          payload.weight_kg = prereq.weight_kg;
          payload.captured_at_reception = true;
        }
        const { data: created, error } = await supabase.from("visits").insert(payload).select("id").single();
        if (error) {
          toast.error(error.message);
          return;
        }
        visit = { id: created!.id, status: "in_progress" };
      } else if (visit.status !== "in_progress") {
        await supabase.from("visits").update({ status: "in_progress" }).eq("id", visit.id);
      }
      await supabase.from("appointments").update({ status: "in_progress" }).eq("id", a.id);
      onChanged();
      navigate(`/dashboard/consultation/${visit.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const continueConsultation = async (a: AppointmentRow) => {
    const v = await findVisit(a.appointment_date);
    if (v) navigate(`/dashboard/consultation/${v.id}`);
    else toast.error("No consultation found");
  };

  const startTreatmentAction = async (a: AppointmentRow) => {
    if (!clinicId) return;
    setBusyId(a.id);
    try {
      const { startTreatmentForAppointment } = await import("@/lib/treatmentStart");
      const result = await startTreatmentForAppointment({
        id: a.id,
        clinic_id: clinicId,
        patient_id: patientId,
        notes: a.notes,
        services: (a.services ?? []) as any,
      });
      if (!result.ok) {
        toast.error(result.error || "Could not start treatment");
        return;
      }
      toast.success(`Started ${result.createdSessions} treatment session(s)`);
      onChanged();
      navigate("/treatment/board");
    } finally {
      setBusyId(null);
    }
  };

  const renderAction = (a: AppointmentRow) => {
    const status = a.status ?? "scheduled";
    const isTx = !!a.is_treatment;
    if (status === "cancelled") {
      return (
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px]">
          Cancelled
        </Badge>
      );
    }
    if (status === "completed") {
      if (isTx) {
        return (
          <Button size="sm" variant="outline" onClick={() => navigate("/treatment/board")}>
            <Eye className="mr-1 h-3 w-3" /> View on Board
          </Button>
        );
      }
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const v = await findVisit(a.appointment_date);
            if (v) {
              const url = new URL(window.location.href);
              url.searchParams.set("tab", "clinical");
              url.searchParams.set("visit", v.id);
              navigate(url.pathname + url.search, { replace: true });
            } else toast.error("No consultation found");
          }}
        >
          <Eye className="mr-1 h-3 w-3" /> View Summary
        </Button>
      );
    }
    if (status === "in_progress") {
      if (isTx) {
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-[#1D9E75] border-[#1D9E75]/40"
            onClick={() => navigate("/treatment/board")}
          >
            <Activity className="mr-1 h-3 w-3" /> Open Board
          </Button>
        );
      }
      return (
        <Button
          size="sm"
          variant="outline"
          className="text-[#1D9E75] border-[#1D9E75]/40"
          onClick={() => continueConsultation(a)}
        >
          <Play className="mr-1 h-3 w-3" /> Continue Consultation
        </Button>
      );
    }
    // scheduled
    if (a.appointment_date > today) {
      return (
        <Badge variant="outline" className="bg-info/15 text-info border-info/30 text-[10px]">
          Upcoming
        </Badge>
      );
    }
    if (a.appointment_date < today) {
      return (
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px]">
          Missed
        </Badge>
      );
    }
    if (isTx) {
      return (
        <Button
          size="sm"
          className="bg-[#1D9E75] hover:bg-[#178a66] text-white"
          disabled={busyId === a.id}
          onClick={() => startTreatmentAction(a)}
        >
          <Activity className="mr-1 h-3 w-3" /> Start Treatment
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        className="bg-[#1D9E75] hover:bg-[#178a66] text-white"
        disabled={busyId === a.id}
        onClick={() => setStartAppt(a)}
      >
        <ArrowRight className="mr-1 h-3 w-3" /> Start Consultation
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {(["all", "upcoming", "past", "cancelled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md capitalize transition",
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <Button onClick={onAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
          <CalendarPlus className="mr-1.5 h-4 w-4" /> Add Appointment
        </Button>
      </div>

      <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  No appointments found for this patient
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">
                    {fmtDateShort(a.appointment_date)}
                    {a.appointment_time && (
                      <span className="text-muted-foreground"> · {a.appointment_time.slice(0, 5)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{a.doctor_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{a.services_label ?? a.reason ?? "Consultation"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span
                        className={cn(
                          "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                          APPT_STATUS_STYLES[a.status ?? "scheduled"] ?? APPT_STATUS_STYLES.scheduled,
                        )}
                      >
                        {a.status ?? "scheduled"}
                      </span>
                      {a.rescheduled_from && (
                        <Badge variant="outline" className="w-fit bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                          Rescheduled
                        </Badge>
                      )}
                      {a.rescheduled_to && a.status === "cancelled" && (
                        <span className="text-[10px] text-muted-foreground">→ moved</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{renderAction(a)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[80px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground ml-2">
            {sorted.length === 0
              ? "0 results"
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, sorted.length)} of ${sorted.length}`}
          </span>
        </div>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Prev
            </Button>
            <span className="px-2 py-1">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>

      <CheckInModal
        open={!!startAppt}
        patientName={patientName}
        appointmentTime={startAppt?.appointment_time?.substring(0, 5)}
        onClose={() => setStartAppt(null)}
        onConfirm={async (data) => {
          if (startAppt) await startConsultation(startAppt, data);
          setStartAppt(null);
        }}
      />
    </div>
  );
}
