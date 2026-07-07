import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mic, FileText, Pill, CheckCircle, AlertTriangle, Activity, History, User, FolderOpen, Upload, Loader2, HeartPulse } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";
import VoiceRecorder from "@/components/doctor/VoiceRecorder";
import PatientHistory from "@/components/doctor/PatientHistory";
import PrescriptionShareModal from "@/components/doctor/PrescriptionShareModal";
import DocumentsTab from "@/components/doctor/DocumentsTab";
import TemplateSelector from "@/components/doctor/TemplateSelector";
import EMRExportButtons from "@/components/doctor/EMRExportButtons";
import OrderInvestigationModal from "@/components/doctor/OrderInvestigationModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { FlaskConical } from "lucide-react";
import { useAuditLog, AUDIT_ACTIONS } from "@/hooks/useAuditLog";

type Visit = {
  id: string;
  token_number: number;
  status: string;
  chief_complaint: string | null;
  vitals: any;
  patient_id: string;
  patient: {
    id: string; name: string; healthcare_id?: string | null; gender: string | null; dob: string | null;
    blood_group?: string | null; allergies: any; chronic_conditions: any;
    phone?: string | null; email?: string | null;
  } | null;
};

type Medication = {
  name: string; dosage: string; morning: boolean; afternoon: boolean;
  evening: boolean; night: boolean; duration: string; notes: string;
};

// Human-readable labels for template section keys
const SECTION_LABELS: Record<string, { label: string; placeholder: string }> = {
  subjective: { label: "Subjective", placeholder: "Patient's symptoms and history..." },
  objective: { label: "Objective", placeholder: "Physical exam findings, vitals..." },
  assessment: { label: "Assessment", placeholder: "Diagnosis and clinical reasoning..." },
  plan: { label: "Plan", placeholder: "Treatment plan, follow-up..." },
  hpi: { label: "History of Present Illness", placeholder: "Detailed history of present illness..." },
  ros: { label: "Review of Systems", placeholder: "Systems review findings..." },
  physical_exam: { label: "Physical Examination", placeholder: "Physical exam findings..." },
  history: { label: "History", placeholder: "Patient history..." },
  examination: { label: "Examination", placeholder: "Examination findings..." },
  diagnosis: { label: "Diagnosis", placeholder: "Diagnosis..." },
  treatment: { label: "Treatment Plan", placeholder: "Treatment plan..." },
  vitals_review: { label: "Vitals Review", placeholder: "Vitals findings..." },
  systems_review: { label: "Systems Review", placeholder: "Systems review..." },
  recommendations: { label: "Recommendations", placeholder: "Recommendations..." },
  presenting_complaint: { label: "Presenting Complaint", placeholder: "Chief presenting complaint..." },
  investigations: { label: "Investigations", placeholder: "Investigation findings..." },
  admission_diagnosis: { label: "Admission Diagnosis", placeholder: "Admission diagnosis..." },
  management_plan: { label: "Management Plan", placeholder: "Management plan..." },
  interval_history: { label: "Interval History", placeholder: "Changes since last visit..." },
  current_status: { label: "Current Status", placeholder: "Current patient status..." },
  medication_review: { label: "Medication Review", placeholder: "Review of current medications..." },
  plan_adjustment: { label: "Plan Adjustment", placeholder: "Adjustments to treatment plan..." },
  reason_for_referral: { label: "Reason for Referral", placeholder: "Why this referral is needed..." },
  clinical_summary: { label: "Clinical Summary", placeholder: "Summary of clinical findings..." },
  current_medications: { label: "Current Medications", placeholder: "List of current medications..." },
  request: { label: "Request", placeholder: "What is being requested..." },
  medications: { label: "Medications", placeholder: "Prescribed medications..." },
  instructions: { label: "Instructions", placeholder: "Patient instructions..." },
  cancer_history: { label: "Cancer History", placeholder: "Cancer history and staging..." },
  treatment_history: { label: "Treatment History", placeholder: "Previous treatments..." },
  chief_complaint: { label: "Chief Complaint", placeholder: "Primary complaint..." },
  treatment_plan: { label: "Treatment Plan", placeholder: "Treatment plan..." },
  formatted: { label: "Clinical Notes", placeholder: "Free-form clinical notes — dictate or type freely..." },
};

const tabs = ["summary", "history", "voice", "soap", "prescription", "documents"] as const;
const tabLabels = ["Summary", "History", "Voice", "SOAP", "Rx", "Docs"];
const tabIcons = [User, History, Mic, FileText, Pill, Upload];

// Default SOAP sections if no template selected
const DEFAULT_SECTIONS = ["subjective", "objective", "assessment", "plan"];

export default function ConsultationWorkspace({ visit, onComplete }: { visit: Visit; onComplete: () => void }) {
  const { profile } = useAuth();
  const { clinic, doctor } = useClinic();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<string>("summary");
  const { log: auditLog } = useAuditLog();

  // Log consultation opened once per visit
  useEffect(() => {
    if (visit?.id && visit.patient?.name) {
      auditLog(AUDIT_ACTIONS.CONSULTATION_OPENED, "visit", visit.id, visit.patient.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit?.id]);

  // Dynamic note fields keyed by section name
  const [noteFields, setNoteFields] = useState<Record<string, string>>({
    subjective: "", objective: "", assessment: "", plan: "",
  });

  // Template
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [activeSections, setActiveSections] = useState<string[]>(["formatted"]);
  const [isReformatting, setIsReformatting] = useState(false);
  const [templateResolved, setTemplateResolved] = useState(false);

  // Fallback: if no template resolves within 2s, default to freeform so the
  // Notes tab never stays blank.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSelectedTemplate((prev: any) => prev ?? { id: "__freeform_fallback__", name: "Free-form", template_type: "freeform", sections: ["formatted"] });
      setTemplateResolved(true);
    }, 2000);
    return () => clearTimeout(timeout);
  }, []);

  // Doctor's enabled templates
  const [enabledTemplateNames, setEnabledTemplateNames] = useState<string[]>(["SOAP Notes"]);

  useEffect(() => {
    if (doctor) {
      // Fetch enabled templates from doctors table
      supabase.from("doctors").select("enabled_templates").eq("id", doctor.id).single()
        .then(({ data }) => {
          if (data?.enabled_templates && Array.isArray(data.enabled_templates)) {
            setEnabledTemplateNames(data.enabled_templates as string[]);
          }
        });
    }
  }, [doctor]);

  // Prescription
  const [medications, setMedications] = useState<Medication[]>([
    { name: "", dosage: "", morning: false, afternoon: false, evening: false, night: false, duration: "", notes: "" },
  ]);
  const [investigations, setInvestigations] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [prescriptionNotes, setPrescriptionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Sharing modal
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePdfUrl, setSharePdfUrl] = useState<string | null>(null);
  const [sharePrescriptionId, setSharePrescriptionId] = useState<string | null>(null);

  // Lab order modal
  const [orderLabOpen, setOrderLabOpen] = useState(false);

  // Lab orders already placed during this visit
  type VisitLabOrder = {
    id: string; test_name: string; test_category: string | null;
    urgency: string | null; status: string | null; ordered_at: string | null;
    lab_id: string | null; lab?: { name: string } | null;
  };
  const [visitLabOrders, setVisitLabOrders] = useState<VisitLabOrder[]>([]);

  const fetchVisitLabOrders = async () => {
    const { data } = await supabase
      .from("lab_orders")
      .select("id, test_name, test_category, urgency, status, ordered_at, lab_id, lab:labs(name)")
      .eq("visit_id", visit.id)
      .order("ordered_at", { ascending: false });
    setVisitLabOrders((data as any) || []);
  };

  useEffect(() => {
    if (!visit.id) return;
    fetchVisitLabOrders();
    const channel = supabase
      .channel(`visit-lab-orders-${visit.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "lab_orders", filter: `visit_id=eq.${visit.id}` },
        () => fetchVisitLabOrders()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit.id]);

  const handleCancelLabOrder = async (orderId: string, testName: string) => {
    if (!confirm(`Cancel the lab order for "${testName}"? The lab will no longer see it as pending.`)) return;
    const { error } = await supabase
      .from("lab_orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);
    if (error) {
      toast.error(error.message || "Failed to cancel order");
      return;
    }
    toast.success("Lab order cancelled");
    fetchVisitLabOrders();
  };

  const getAge = (dob: string | null) => {
    if (!dob) return "N/A";
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const vitals = visit.vitals || {};

  const isFreeformTemplate = (t: any) =>
    t?.template_type === "freeform" || (typeof t?.name === "string" && t.name.toLowerCase().includes("free"));

  const handleTemplateChange = async (template: any) => {
    // No-op if the same template is re-selected (prevents remount side-effects
    // like re-merging freeform content and re-adding label prefixes on tab switches).
    if (template?.id && template.id === selectedTemplate?.id) {
      return;
    }
    const previousValues = { ...noteFields };
    const isFreeform = isFreeformTemplate(template);
    const newSections: string[] = isFreeform
      ? ["formatted"]
      : (template?.sections && Array.isArray(template.sections) && template.sections.length
          ? template.sections
          : DEFAULT_SECTIONS);

    // Only consider SOAP-style previous values for merging (skip the freeform
    // "formatted" bucket so we never prepend "Clinical Notes:" onto already-freeform text).
    const soapPrev = Object.fromEntries(
      Object.entries(previousValues).filter(([k]) => k !== "formatted")
    );
    const hasSoapContent = Object.values(soapPrev).some(v => v && v.trim().length > 0);

    setSelectedTemplate(template);
    setActiveSections(newSections);

    if (!hasSoapContent) {
      if (isFreeform) {
        // Preserve existing freeform text as-is (no prefix ever added).
        setNoteFields({ formatted: previousValues.formatted || "" });
      } else {
        const newFields: Record<string, string> = {};
        newSections.forEach(s => { newFields[s] = ""; });
        setNoteFields(newFields);
      }
      return;
    }

    // For freeform, merge existing SOAP content into one block
    if (isFreeform) {
      const merged = Object.entries(soapPrev)
        .filter(([_, v]) => v && v.trim())
        .map(([k, v]) => {
          const meta = SECTION_LABELS[k];
          const label = meta ? meta.label : k.replace(/_/g, " ");
          return `${label}:\n${v}`;
        })
        .join("\n\n");
      const combined = [previousValues.formatted?.trim(), merged].filter(Boolean).join("\n\n");
      setNoteFields({ formatted: combined });
      return;
    }

    setIsReformatting(true);
    try {
      const existingContent = Object.entries(previousValues)
        .filter(([_, v]) => v && v.trim())
        .map(([k, v]) => {
          const meta = SECTION_LABELS[k];
          const label = meta ? meta.label : k.replace(/_/g, " ");
          return `${label}: ${v}`;
        })
        .join("\n\n");

      const fieldDefinitions = newSections.map(s => {
        const meta = SECTION_LABELS[s] || {
          label: s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          placeholder: `Enter ${s.replace(/_/g, " ")}...`,
        };
        return { key: s, label: meta.label, placeholder: meta.placeholder };
      });

      const { data, error } = await supabase.functions.invoke("reformat-notes", {
        body: {
          existing_content: existingContent,
          new_template_name: template?.name || "SOAP Notes",
          field_definitions: fieldDefinitions,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const mapped: Record<string, string> = {};
      newSections.forEach(s => {
        mapped[s] = data[s] || "";
      });
      setNoteFields(mapped);
      toast.success(`Notes reformatted to ${template?.name || "new template"}`);
    } catch (err: any) {
      console.error("Reformat error:", err);
      toast.error("Could not reformat notes, showing empty fields");
      const emptyFields: Record<string, string> = {};
      newSections.forEach(s => { emptyFields[s] = ""; });
      setNoteFields(emptyFields);
    } finally {
      setIsReformatting(false);
    }
  };

  const updateNoteField = (key: string, value: string) => {
    setNoteFields(prev => ({ ...prev, [key]: value }));
  };

  const handleTranscriptProcessed = (soapData: any) => {
    // Free-form mode: dump the cleaned dictation into the first available section
    if (soapData?.formatted_text) {
      const target = activeSections[0] ?? "subjective";
      updateNoteField(target, soapData.formatted_text);
      setTab("soap");
      toast.success("Notes formatted from transcript!");
      return;
    }
    if (soapData.subjective) updateNoteField("subjective", soapData.subjective);
    if (soapData.objective) updateNoteField("objective", soapData.objective);
    if (soapData.assessment) updateNoteField("assessment", soapData.assessment);
    if (soapData.plan) updateNoteField("plan", soapData.plan);
    if (soapData.medications?.length) {
      setMedications(soapData.medications.map((m: any) => ({
        name: m.name || "", dosage: m.dosage || "",
        morning: !!m.morning, afternoon: !!m.afternoon,
        evening: !!m.evening, night: !!m.night,
        duration: m.duration || "", notes: m.notes || m.instructions || "",
      })));
    }
    if (soapData.investigations?.length) setInvestigations(soapData.investigations.join(", "));
    setTab("soap");
    toast.success("SOAP notes generated from transcript!");
  };

  const addMedRow = () => setMedications(prev => [...prev, { name: "", dosage: "", morning: false, afternoon: false, evening: false, night: false, duration: "", notes: "" }]);
  const removeMedRow = (idx: number) => setMedications(prev => prev.filter((_, i) => i !== idx));
  const updateMed = (idx: number, field: keyof Medication, value: any) => {
    setMedications(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  // Build SOAP notes object from active sections for saving
  const buildSoapNotes = () => {
    const soap: Record<string, string> = {};
    activeSections.forEach(s => {
      if (noteFields[s]?.trim()) soap[s] = noteFields[s];
    });
    // Store which template was used so history/PDF can render correct field labels
    if (selectedTemplate?.name) {
      soap._template = selectedTemplate.name;
    }
    return soap;
  };

  // Get assessment-like field for validation
  const getAssessmentField = () => {
    // Check for assessment, diagnosis, or admission_diagnosis in active sections
    for (const key of ["assessment", "diagnosis", "admission_diagnosis", "current_status"]) {
      if (activeSections.includes(key) && noteFields[key]?.trim()) return noteFields[key];
    }
    // If no assessment-type field, accept any filled field
    for (const key of activeSections) {
      if (noteFields[key]?.trim()) return noteFields[key];
    }
    return "";
  };

  const handleCompleteConsultation = async () => {
    if (!getAssessmentField()) {
      toast.error("Please fill in at least one field in the clinical notes before completing.");
      setTab("soap");
      return;
    }
    setSaving(true);
    try {
      const { data: doctorRow } = await supabase
        .from("doctors").select("id").eq("user_id", profile!.user_id).single();
      if (!doctorRow) throw new Error("Doctor profile not found");

      const soapNotes = buildSoapNotes();

      await supabase.from("clinical_notes").insert({
        visit_id: visit.id, doctor_id: doctorRow.id,
        soap_notes: soapNotes,
      });

      const validMeds = medications.filter(m => m.name.trim());
      let prescriptionId: string | null = null;
      if (validMeds.length > 0 || investigations.trim()) {
        const { data: prescData } = await supabase.from("prescriptions").insert({
          visit_id: visit.id, doctor_id: doctorRow.id,
          medications: validMeds,
          investigations: investigations ? investigations.split(",").map(s => s.trim()) : [],
          follow_up_date: followUpDate || null,
          notes: prescriptionNotes || null,
        }).select("id").single();
        prescriptionId = prescData?.id ?? null;
      }

      await supabase.from("visits").update({ status: "completed", doctor_id: doctorRow.id }).eq("id", visit.id);

      // Mirror completion on today's appointment for this patient
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: completedAppts } = await supabase.from("appointments")
          .update({ status: "completed" })
          .eq("patient_id", visit.patient_id)
          .eq("appointment_date", today)
          .in("status", ["scheduled", "confirmed", "in_progress"])
          .select("id, clinic_id, patient_id, appointment_date");
        // Care call check for first-ever appointment
        const { checkAndSetCareCall } = await import("@/lib/careCall");
        for (const a of completedAppts ?? []) {
          await checkAndSetCareCall(a.id, a.patient_id, a.clinic_id, a.appointment_date);
        }
      } catch { /* non-fatal */ }

      // Save default template for doctor (both name and id)
      if (selectedTemplate) {
        await supabase.from("doctors").update({
          default_template: selectedTemplate.name,
          default_template_id: selectedTemplate.id,
        } as any).eq("id", doctorRow.id);
      }

      if (prescriptionId) {
        const { data: pdfResult, error: pdfError } = await supabase.functions.invoke("generate-prescription-pdf", {
          body: { visit_id: visit.id, prescription_id: prescriptionId },
        });
        if (!pdfError && pdfResult?.path) {
          setSharePdfUrl(pdfResult.path);
          setSharePrescriptionId(prescriptionId);
          setShareOpen(true);
          toast.success("Prescription generated!");
          auditLog(AUDIT_ACTIONS.PRESCRIPTION_GENERATED, "prescription", prescriptionId, visit.patient?.name);
        } else {
          toast.success("Consultation completed! (PDF generation in progress)");
          auditLog(AUDIT_ACTIONS.NOTES_SAVED, "clinical_notes", visit.id, visit.patient?.name);
          onComplete();
        }
      } else {
        toast.success("Consultation completed!");
        auditLog(AUDIT_ACTIONS.NOTES_SAVED, "clinical_notes", visit.id, visit.patient?.name);
        onComplete();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Patient Header */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 font-display text-lg font-bold text-primary">
                #{visit.token_number}
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">{visit.patient?.name}</h2>
                {selectedTemplate && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {selectedTemplate.template_type === "freeform" ? "📝 Freeform Notes" : "📋 SOAP Notes"} · {selectedTemplate.name}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {visit.patient?.healthcare_id && (
                    <span className="font-mono text-xs text-primary">{visit.patient.healthcare_id}</span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {visit.patient?.gender} • {getAge(visit.patient?.dob ?? null)}y
                    {visit.patient?.blood_group && ` • ${visit.patient.blood_group}`}
                  </span>
                </div>
                {visit.chief_complaint && (
                  <p className="text-sm font-medium text-foreground mt-1 bg-warning/10 text-warning px-2 py-0.5 rounded-lg inline-block">
                    {visit.chief_complaint}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {visit.patient?.allergies && Array.isArray(visit.patient.allergies) && visit.patient.allergies.length > 0 && (
                (visit.patient.allergies as string[]).map((a: string) => (
                  <Badge key={a} variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg">
                    <AlertTriangle className="mr-1 h-3 w-3" /> {a}
                  </Badge>
                ))
              )}
              {visit.patient?.chronic_conditions && Array.isArray(visit.patient.chronic_conditions) && visit.patient.chronic_conditions.length > 0 && (
                (visit.patient.chronic_conditions as string[]).map((c: string) => (
                  <Badge key={c} variant="outline" className="border-warning/30 bg-warning/10 text-warning rounded-lg">
                    {c}
                  </Badge>
                ))
              )}
            </div>
          </div>

          {Object.keys(vitals).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {vitals.bp && (
                <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs">
                  <Activity className="h-3 w-3 text-primary" />
                  <span className="font-medium">BP:</span> {vitals.bp.systolic}/{vitals.bp.diastolic}
                </div>
              )}
              {vitals.pulse && <div className="rounded-lg bg-muted px-3 py-1.5 text-xs"><span className="font-medium">Pulse:</span> {vitals.pulse}</div>}
              {vitals.temperature && <div className="rounded-lg bg-muted px-3 py-1.5 text-xs"><span className="font-medium">Temp:</span> {vitals.temperature}°F</div>}
              {vitals.spo2 && <div className="rounded-lg bg-muted px-3 py-1.5 text-xs"><span className="font-medium">SpO2:</span> {vitals.spo2}%</div>}
              {vitals.weight && <div className="rounded-lg bg-muted px-3 py-1.5 text-xs"><span className="font-medium">Wt:</span> {vitals.weight}kg</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile: 2x3 grid of pill buttons */}
      {isMobile ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1.5 p-2 bg-muted/50 rounded-xl md:hidden">
            {tabs.map((t, i) => {
              const Icon = tabIcons[i];
              const label = t === "soap" && isFreeformTemplate(selectedTemplate) ? "Notes" : tabLabels[i];
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-lg text-xs font-medium transition-all ${
                    tab === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground border border-border"
                  }`}
                >
                  <Icon className="w-4 h-4 mb-0.5" />
                  {label}
                </button>
              );
            })}
          </div>

          {tab === "summary" && renderSummary()}
          {tab === "history" && visit.patient && <PatientHistory patientId={visit.patient.id} currentVisitId={visit.id} />}
          {tab === "voice" && <VoiceRecorder visitId={visit.id} onTranscriptProcessed={handleTranscriptProcessed} clinicId={profile?.clinic_id} doctorId={doctor?.id} templateName={selectedTemplate?.name} templateType={selectedTemplate?.template_type} templateFields={activeSections} />}
          {tab === "soap" && renderSoap()}
          {tab === "prescription" && renderPrescription()}
          {tab === "documents" && visit.patient && profile?.clinic_id && (
            <DocumentsTab visitId={visit.id} patientId={visit.patient.id} clinicId={profile.clinic_id} />
          )}

          <Button className="w-full h-12 rounded-xl font-medium" onClick={handleCompleteConsultation} disabled={saving}>
            <CheckCircle className="mr-2 h-5 w-5" />
            {saving ? "Saving..." : "Complete Consultation"}
          </Button>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="summary" className="rounded-lg">Summary</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg"><History className="mr-1.5 h-3.5 w-3.5" /> History</TabsTrigger>
            <TabsTrigger value="voice" className="rounded-lg"><Mic className="mr-1.5 h-3.5 w-3.5" /> Voice</TabsTrigger>
            <TabsTrigger value="soap" className="rounded-lg"><FileText className="mr-1.5 h-3.5 w-3.5" /> {isFreeformTemplate(selectedTemplate) ? "Notes" : "SOAP"}</TabsTrigger>
            <TabsTrigger value="prescription" className="rounded-lg"><Pill className="mr-1.5 h-3.5 w-3.5" /> Rx</TabsTrigger>
            <TabsTrigger value="documents" className="rounded-lg"><FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Docs</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">{renderSummary()}</TabsContent>
          <TabsContent value="history">
            {visit.patient && <PatientHistory patientId={visit.patient.id} currentVisitId={visit.id} />}
          </TabsContent>
          <TabsContent value="voice">
            <VoiceRecorder visitId={visit.id} onTranscriptProcessed={handleTranscriptProcessed} clinicId={profile?.clinic_id} doctorId={doctor?.id} templateName={selectedTemplate?.name} templateType={selectedTemplate?.template_type} templateFields={activeSections} />
          </TabsContent>
          <TabsContent value="soap">{renderSoap()}</TabsContent>
          <TabsContent value="prescription">{renderPrescription()}</TabsContent>
          <TabsContent value="documents">
            {visit.patient && profile?.clinic_id && (
              <DocumentsTab visitId={visit.id} patientId={visit.patient.id} clinicId={profile.clinic_id} />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Desktop: Complete + Treatment plan */}
      {!isMobile && (
        <div className="flex justify-end gap-2">
          <TreatmentPlanButton patientId={visit.patient?.id} />
          <Button size="lg" className="rounded-xl font-medium" onClick={handleCompleteConsultation} disabled={saving}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Complete Consultation"}
          </Button>
        </div>
      )}

      {profile?.clinic_id && doctor && visit.patient && (
        <OrderInvestigationModal
          open={orderLabOpen}
          onClose={() => setOrderLabOpen(false)}
          clinicId={profile.clinic_id}
          visitId={visit.id}
          patientId={visit.patient.id}
          patientName={visit.patient.name}
          doctorId={doctor.id}
          doctorName={doctor.name || "Doctor"}
          clinicName={clinic?.name || "Clinic"}
          onOrdered={fetchVisitLabOrders}
        />
      )}

      <PrescriptionShareModal
        open={shareOpen}
        onClose={() => { setShareOpen(false); onComplete(); }}
        prescriptionPdfUrl={sharePdfUrl}
        prescriptionId={sharePrescriptionId}
        patient={visit.patient ? {
          name: visit.patient.name, phone: visit.patient.phone || null,
          email: visit.patient.email || null, healthcare_id: visit.patient.healthcare_id || null,
        } : null}
        clinicName={clinic?.name || "Clinic"}
        doctorName={doctor?.name || "Doctor"}
        emrExportProps={visit.patient ? {
          patient: { name: visit.patient.name, healthcare_id: visit.patient.healthcare_id, dob: visit.patient.dob, gender: visit.patient.gender, phone: visit.patient.phone },
          visit: { id: visit.id, chief_complaint: visit.chief_complaint },
          doctor: { name: doctor?.name || "", registration_number: doctor?.registration_number || "" },
          soap: buildSoapNotes(),
          medications,
          investigations: investigations ? investigations.split(",").map(s => s.trim()) : [],
          followUpDate,
        } : undefined}
      />
    </div>
  );

  function renderSummary() {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="font-display font-semibold mb-3">Patient Summary</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label className="text-xs text-muted-foreground">Full Name</Label><p className="font-medium">{visit.patient?.name}</p></div>
            <div><Label className="text-xs text-muted-foreground">Healthcare ID</Label><p className="font-mono font-medium text-primary">{visit.patient?.healthcare_id || "—"}</p></div>
            <div><Label className="text-xs text-muted-foreground">Age / Gender</Label><p className="font-medium">{getAge(visit.patient?.dob ?? null)}y / {visit.patient?.gender}</p></div>
            <div><Label className="text-xs text-muted-foreground">Blood Group</Label><p className="font-medium">{visit.patient?.blood_group || "—"}</p></div>
            <div><Label className="text-xs text-muted-foreground">Chief Complaint</Label><p className="font-medium">{visit.chief_complaint || "—"}</p></div>
            <div><Label className="text-xs text-muted-foreground">Chronic Conditions</Label>
              <p className="font-medium">
                {visit.patient?.chronic_conditions && Array.isArray(visit.patient.chronic_conditions) && visit.patient.chronic_conditions.length > 0
                  ? (visit.patient.chronic_conditions as string[]).join(", ") : "None"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderSoap() {
    const isFreeform = isFreeformTemplate(selectedTemplate);
    const templateLoaded = !!selectedTemplate;
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="space-y-4 p-6">
          {profile?.clinic_id && doctor && (
            <TemplateSelector
              clinicId={profile.clinic_id}
              doctorId={doctor.id}
              doctorDefaultTemplateId={(doctor as any)?.default_template_id || null}
              enabledTemplateNames={enabledTemplateNames}
              onTemplateChange={handleTemplateChange}
            />
          )}
          {isReformatting ? (
            <div className="flex items-center justify-center gap-2 py-8 text-primary">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Reformatting notes to {selectedTemplate?.name || "new template"}...</span>
            </div>
          ) : !templateLoaded ? (
            <div className="space-y-3 py-4">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="h-[300px] rounded-lg bg-muted/50 animate-pulse" />
            </div>
          ) : isFreeform ? (
            <div className="space-y-2">
              <Label className="font-semibold">Clinical Notes</Label>
              <Textarea
                rows={14}
                value={noteFields.formatted || ""}
                onChange={e => updateNoteField("formatted", e.target.value)}
                placeholder="Type or use voice to record consultation notes..."
                className="min-h-[300px] rounded-lg"
              />
            </div>
          ) : (
            activeSections.map(section => {
              const meta = SECTION_LABELS[section] || {
                label: section.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
                placeholder: `Enter ${section.replace(/_/g, " ")}...`
              };
              return (
                <div key={section} className="space-y-2">
                  <Label className="font-semibold">{meta.label}</Label>
                  <Textarea
                    rows={3}
                    value={noteFields[section] || ""}
                    onChange={e => updateNoteField(section, e.target.value)}
                    placeholder={meta.placeholder}
                    className="rounded-lg"
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    );
  }

  function renderPrescription() {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div>
            <Label className="font-semibold mb-3 block">Medications (Rx)</Label>
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-12 gap-1 text-xs font-semibold text-muted-foreground px-1 py-1 mb-1">
              <div className="col-span-3">Drug</div>
              <div className="col-span-2">Dosage</div>
              <div className="col-span-4 text-center">M · A · E · N</div>
              <div className="col-span-2">Duration</div>
              <div className="col-span-1"></div>
            </div>
            <div className="space-y-2">
              {medications.map((med, i) => (
                <div key={i} className="grid grid-cols-12 gap-1 items-center py-2 border-b border-border last:border-0">
                  <div className="col-span-12 sm:col-span-3">
                    <Input placeholder="Drug name" value={med.name} onChange={e => updateMed(i, "name", e.target.value)} className="rounded-lg text-sm h-9" />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <Input placeholder="Dosage" value={med.dosage} onChange={e => updateMed(i, "dosage", e.target.value)} className="rounded-lg text-sm h-9" />
                  </div>
                  <div className="col-span-5 sm:col-span-4 flex gap-3 justify-center">
                    {(["morning", "afternoon", "evening", "night"] as const).map(timing => (
                      <label key={timing} className="flex flex-col items-center text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={med[timing] || false}
                          onChange={e => updateMed(i, timing, e.target.checked)}
                          className="accent-primary w-4 h-4"
                        />
                        {timing === "morning" ? "M" : timing === "afternoon" ? "A" : timing === "evening" ? "E" : "N"}
                      </label>
                    ))}
                  </div>
                  <div className="col-span-10 sm:col-span-2">
                    <Input placeholder="Duration" value={med.duration} onChange={e => updateMed(i, "duration", e.target.value)} className="rounded-lg text-sm h-9" />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-center">
                    <button onClick={() => removeMedRow(i)} className="text-destructive/60 hover:text-destructive text-lg">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addMedRow} className="mt-2 rounded-lg">+ Add Medication</Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Investigations</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOrderLabOpen(true)}
                className="rounded-lg h-8 text-xs"
              >
                <FlaskConical className="mr-1.5 h-3.5 w-3.5" /> Order to Lab
              </Button>
            </div>
            <Input value={investigations} onChange={e => setInvestigations(e.target.value)} placeholder="CBC, LFT, ECG..." className="rounded-lg" />
            <p className="text-xs text-muted-foreground">Tests listed here appear on the prescription. Use "Order to Lab" to send a structured order to a registered lab.</p>

            {visitLabOrders.length > 0 && (
              <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <FlaskConical className="h-3.5 w-3.5 text-primary" />
                  Lab orders placed this visit ({visitLabOrders.length})
                </div>
                <ul className="space-y-1.5">
                  {visitLabOrders.map(o => (
                    <li key={o.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-foreground truncate">{o.test_name}</span>
                        {o.test_category && <span className="text-muted-foreground">· {o.test_category}</span>}
                        {o.lab?.name && <span className="text-muted-foreground truncate">→ {o.lab.name}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {o.urgency && o.urgency !== "routine" && (
                          <Badge variant={o.urgency === "stat" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0 h-4 uppercase">
                            {o.urgency}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                          {o.status || "ordered"}
                        </Badge>
                        {(o.status === "ordered" || !o.status) && (
                          <button
                            type="button"
                            onClick={() => handleCancelLabOrder(o.id, o.test_name)}
                            className="text-[10px] font-medium text-destructive/80 hover:text-destructive hover:underline ml-0.5"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label className="font-semibold">Follow-up Date</Label><Input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="rounded-lg" /></div>
            <div className="space-y-2"><Label className="font-semibold">Notes</Label><Input value={prescriptionNotes} onChange={e => setPrescriptionNotes(e.target.value)} placeholder="Additional notes..." className="rounded-lg" /></div>
          </div>
        </CardContent>
      </Card>
    );
  }
}

function TreatmentPlanButton({ patientId }: { patientId?: string }) {
  const { enabled } = useTreatmentEnabled();
  const navigate = useNavigate();
  if (!enabled || !patientId) return null;
  return (
    <Button
      variant="outline"
      size="lg"
      className="rounded-xl font-medium"
      onClick={() => navigate(`/treatment/schedule?patient_id=${patientId}`)}
    >
      <HeartPulse className="mr-2 h-4 w-4" />
      Start Treatment Plan
    </Button>
  );
}
