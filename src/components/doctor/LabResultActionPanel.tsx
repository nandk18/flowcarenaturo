import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FlaskConical, Loader2, Send, ExternalLink, Plus, Trash2, Mic, MicOff, CheckCircle2, ArrowRight } from "lucide-react";
import PrescriptionShareModal from "@/components/doctor/PrescriptionShareModal";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { withRetry } from "@/lib/errors";

type Medication = {
  name: string; dosage: string;
  morning: boolean; afternoon: boolean; evening: boolean; night: boolean;
  duration: string; notes: string;
};

type LabResultLite = {
  id: string;
  file_url: string | null;
  ai_summary: any;
  status?: string | null;
  patient_id: string;
  patient: { name: string; healthcare_id: string | null; phone: string | null; email: string | null } | null;
  order: { test_name: string; visit_id: string | null } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  result: LabResultLite | null;
  doctorId: string | null;
  doctorName: string;
  clinicName: string;
  onActioned?: () => void;
};

const statusBadgeClass = (status?: string) => {
  switch (status) {
    case "critical": return "bg-destructive/10 text-destructive border-destructive/20";
    case "abnormal":
    case "borderline": return "bg-warning/10 text-warning border-warning/20";
    case "normal": return "bg-success/10 text-success border-success/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const emptyMed = (): Medication => ({
  name: "", dosage: "", morning: false, afternoon: false, evening: false, night: false, duration: "", notes: "",
});

export default function LabResultActionPanel({ open, onClose, result, doctorId, doctorName, clinicName, onActioned }: Props) {
  const navigate = useNavigate();
  const [doctorNotes, setDoctorNotes] = useState("");
  const [medications, setMedications] = useState<Medication[]>([emptyMed()]);
  const [followUpDate, setFollowUpDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [prescriptionPdfUrl, setPrescriptionPdfUrl] = useState<string | null>(null);
  const [isFormattingMeds, setIsFormattingMeds] = useState(false);

  // Voice recording (shared hook) — also auto-extracts medications via AI
  const { isRecording, isTranscribing, toggleRecording } = useVoiceRecorder(async (transcript) => {
    // 1. Append transcript to notes
    setDoctorNotes((prev) => (prev ? prev + "\n" + transcript : transcript));

    // 2. Try to extract medications using format-soap-notes
    setIsFormattingMeds(true);
    try {
      const { data, error } = await supabase.functions.invoke("format-soap-notes", {
        body: {
          transcript,
          template_name: "Prescription Only",
          template_sections: ["diagnosis", "instructions"],
          patient_context: {
            name: result?.patient?.name,
            test: result?.order?.test_name,
          },
        },
      });
      if (error) throw error;
      if (data?.medications && Array.isArray(data.medications) && data.medications.length > 0) {
        setMedications((prev) => {
          const existing = prev.filter((m) => m.name.trim());
          const incoming: Medication[] = data.medications.map((m: any) => ({
            name: m.name || "",
            dosage: m.dosage || "",
            morning: !!m.morning,
            afternoon: !!m.afternoon,
            evening: !!m.evening,
            night: !!m.night,
            duration: m.duration || "",
            notes: m.notes || "",
          }));
          return [...existing, ...incoming];
        });
        toast.success(`Extracted ${data.medications.length} medication${data.medications.length === 1 ? "" : "s"} from voice`);
      }
    } catch {
      // silent — notes still populated
    } finally {
      setIsFormattingMeds(false);
    }
  });

  const isActioned = result?.status === "actioned";

  useEffect(() => {
    if (open) {
      setDoctorNotes("");
      setMedications([emptyMed()]);
      setFollowUpDate("");
      setShowShare(false);
      setPrescriptionId(null);
      setPrescriptionPdfUrl(null);
    }
  }, [open, result?.id]);

  const handleViewDocument = async () => {
    if (!result?.file_url) { toast.error("No document attached"); return; }
    const { data } = await supabase.storage.from("lab-results").createSignedUrl(result.file_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const updateMed = (idx: number, patch: Partial<Medication>) =>
    setMedications(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m));
  const addMed = () => setMedications(prev => [...prev, emptyMed()]);
  const removeMed = (idx: number) => setMedications(prev => prev.filter((_, i) => i !== idx));

  const handleGenerate = async () => {
    if (!result || !doctorId) return;
    const validMeds = medications.filter(m => m.name.trim());
    if (validMeds.length === 0 && !doctorNotes.trim()) {
      toast.error("Add notes or medications before submitting");
      return;
    }
    if (!result.order?.visit_id) {
      toast.error("This lab order is not linked to a visit; cannot create a prescription.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Save doctor notes + mark actioned
      await supabase.from("lab_results").update({
        doctor_notes: doctorNotes,
        status: "actioned",
        reviewed_at: new Date().toISOString(),
      }).eq("id", result.id);

      // 2. Create prescription on the original visit
      const noteText = `Based on ${result.order.test_name} result${doctorNotes ? `: ${doctorNotes}` : ""}`;
      const { data: prescription, error: pErr } = await supabase.from("prescriptions").insert({
        visit_id: result.order.visit_id,
        doctor_id: doctorId,
        medications: validMeds,
        follow_up_date: followUpDate || null,
        notes: noteText,
      }).select().single();
      if (pErr) throw pErr;

      // 3. Link prescription to result
      await supabase.from("lab_results")
        .update({ actioned_prescription_id: prescription.id })
        .eq("id", result.id);

      // 4. Generate PDF/HTML
      const { data: pdfData, error: pdfErr } = await withRetry(() =>
        supabase.functions.invoke("generate-prescription-pdf", {
          body: { visit_id: result.order.visit_id, prescription_id: prescription.id },
        })
      , 3, 1000);
      if (pdfErr) {
        console.warn("PDF generation failed:", pdfErr);
      }
      setPrescriptionPdfUrl(pdfData?.path || pdfData?.pdf_url || pdfData?.url || null);
      setPrescriptionId(prescription.id);
      setShowShare(true);
      toast.success("Prescription generated");
      onActioned?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate prescription");
    } finally {
      setSubmitting(false);
    }
  };

  if (!result) return null;

  const summary = result.ai_summary || {};

  return (
    <>
      <Sheet open={open} onOpenChange={o => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 font-display">
              <FlaskConical className="h-5 w-5 text-primary" /> Act on Lab Result
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-5">
            {/* Summary */}
            <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-semibold text-foreground">{result.order?.test_name || "Lab Result"}</span>
                <Badge variant="outline" className={`rounded-md text-xs ${statusBadgeClass(summary.overall_status)}`}>
                  {summary.overall_status?.toUpperCase() || "PENDING AI"}
                </Badge>
                {summary.urgent && <Badge variant="destructive" className="rounded-md text-xs">URGENT</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Patient: <span className="font-medium text-foreground">{result.patient?.name}</span>
                {result.patient?.healthcare_id && <span className="font-mono text-primary"> · {result.patient.healthcare_id}</span>}
              </p>
              {summary.one_line_summary && (
                <p className="text-sm text-foreground"><span className="text-xs text-primary font-semibold mr-1">AI</span>{summary.one_line_summary}</p>
              )}
            </div>

            {/* Abnormal values */}
            {summary.abnormal_values?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-destructive mb-2">⚠️ Abnormal Values</p>
                <div className="space-y-1">
                  {summary.abnormal_values.map((v: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-xs bg-destructive/5 border border-destructive/10 rounded-md px-3 py-1.5">
                      <span className="font-medium">{v.parameter}</span>
                      <span className="text-destructive font-semibold">{v.value}</span>
                      <span className="text-muted-foreground">Normal: {v.normal_range}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" onClick={handleViewDocument} className="w-full rounded-lg">
              <ExternalLink className="mr-2 h-4 w-4" /> View Full Document
            </Button>

            {isActioned ? (
              /* Already actioned — read-only state */
              <div className="rounded-xl bg-success/5 border border-success/20 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span className="font-semibold text-foreground">Already Actioned</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  A prescription was generated for this result. To make changes, go to the patient's history.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/dashboard/patients/${result.patient_id}`)}
                  className="rounded-lg text-xs"
                >
                  Go to Patient History <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                {/* Doctor notes with voice scribe */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Clinical Response / Doctor's Notes</Label>
                    <Button
                      type="button"
                      size="sm"
                      onClick={toggleRecording}
                      disabled={isTranscribing}
                      className={`rounded-full text-xs h-8 ${
                        isRecording ? "bg-destructive hover:bg-destructive/90 animate-pulse" : ""
                      }`}
                    >
                      {isTranscribing ? (
                        <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Transcribing...</>
                      ) : isRecording ? (
                        <><MicOff className="mr-1.5 h-3 w-3" /> Stop Recording</>
                      ) : (
                        <><Mic className="mr-1.5 h-3 w-3" /> Voice Note</>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={doctorNotes}
                    onChange={e => setDoctorNotes(e.target.value)}
                    placeholder="Speak or type your clinical interpretation..."
                    rows={4}
                    className="rounded-lg"
                  />
                </div>

                {/* Medications */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Medications</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addMed} className="rounded-lg text-xs">
                      <Plus className="mr-1 h-3 w-3" /> Add Medicine
                    </Button>
                  </div>
                  {isFormattingMeds && (
                    <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Extracting medications from voice...
                    </div>
                  )}
                  <div className="space-y-2">
                    {medications.map((med, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-2">
                        <div className="grid grid-cols-12 gap-2">
                          <Input className="col-span-7 rounded-md" placeholder="Medicine name"
                            value={med.name} onChange={e => updateMed(i, { name: e.target.value })} />
                          <Input className="col-span-4 rounded-md" placeholder="Dosage"
                            value={med.dosage} onChange={e => updateMed(i, { dosage: e.target.value })} />
                          <Button type="button" variant="ghost" size="icon" className="col-span-1 h-9 w-9 text-destructive"
                            onClick={() => removeMed(i)} disabled={medications.length === 1}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {(["morning", "afternoon", "evening", "night"] as const).map(t => (
                            <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                              <Checkbox checked={med[t]} onCheckedChange={v => updateMed(i, { [t]: !!v })} />
                              <span className="capitalize">{t[0].toUpperCase()}</span>
                            </label>
                          ))}
                          <Input className="flex-1 min-w-[100px] h-8 rounded-md text-xs" placeholder="Duration (e.g. 5 days)"
                            value={med.duration} onChange={e => updateMed(i, { duration: e.target.value })} />
                        </div>
                        <Input className="rounded-md text-xs h-8" placeholder="Instructions (optional)"
                          value={med.notes} onChange={e => updateMed(i, { notes: e.target.value })} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Follow up */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Follow-up Date</Label>
                  <Input type="date" value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)} className="rounded-lg max-w-xs" />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={onClose} disabled={submitting} className="flex-1 rounded-lg">
                    Cancel
                  </Button>
                  <Button onClick={handleGenerate} disabled={submitting} className="flex-1 rounded-lg">
                    {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Send className="mr-2 h-4 w-4" /> Generate & Send Prescription</>}
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <PrescriptionShareModal
        open={showShare}
        onClose={() => { setShowShare(false); onClose(); }}
        prescriptionPdfUrl={prescriptionPdfUrl}
        prescriptionId={prescriptionId}
        patient={result.patient ? {
          name: result.patient.name,
          phone: result.patient.phone,
          email: result.patient.email,
          healthcare_id: result.patient.healthcare_id,
        } : null}
        clinicName={clinicName}
        doctorName={doctorName}
      />
    </>
  );
}
