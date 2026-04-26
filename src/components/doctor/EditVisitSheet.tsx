import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, FileText } from "lucide-react";
import { TEMPLATE_FIELDS } from "@/lib/templateFields";

type Medication = {
  name: string; dosage: string;
  morning: boolean; afternoon: boolean; evening: boolean; night: boolean;
  duration: string; notes: string;
};

type EditableVisit = {
  id: string;
  clinical_notes_id: string | null;
  soap_notes: any;
  prescription_id: string | null;
  medications: any;
  follow_up_date: string | null;
  prescription_notes: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  visit: EditableVisit | null;
  onSaved: () => void;
};

const emptyMed = (): Medication => ({
  name: "", dosage: "", morning: false, afternoon: false, evening: false, night: false, duration: "", notes: "",
});

export default function EditVisitSheet({ open, onClose, visit, onSaved }: Props) {
  const [soap, setSoap] = useState<Record<string, any>>({});
  const [medications, setMedications] = useState<Medication[]>([emptyMed()]);
  const [followUpDate, setFollowUpDate] = useState("");
  const [prescriptionNotes, setPrescriptionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const templateName = soap._template || visit?.soap_notes?._template || "SOAP Notes";
  const fields = TEMPLATE_FIELDS[templateName] || TEMPLATE_FIELDS["SOAP Notes"];

  useEffect(() => {
    if (open && visit) {
      setSoap(visit.soap_notes || {});
      const meds = Array.isArray(visit.medications) && visit.medications.length > 0
        ? visit.medications.map((m: any) => ({
            name: m.name || "", dosage: m.dosage || "",
            morning: !!m.morning, afternoon: !!m.afternoon, evening: !!m.evening, night: !!m.night,
            duration: m.duration || "", notes: m.notes || "",
          }))
        : [emptyMed()];
      setMedications(meds);
      setFollowUpDate(visit.follow_up_date || "");
      setPrescriptionNotes(visit.prescription_notes || "");
    }
  }, [open, visit]);

  const updateMed = (idx: number, patch: Partial<Medication>) =>
    setMedications(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m));
  const addMed = () => setMedications(prev => [...prev, emptyMed()]);
  const removeMed = (idx: number) => setMedications(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!visit) return;
    setSaving(true);
    try {
      // Update clinical notes
      if (visit.clinical_notes_id) {
        const cleanedSoap: Record<string, any> = { _template: templateName };
        for (const f of fields) {
          if (soap[f.key] !== undefined) cleanedSoap[f.key] = soap[f.key];
        }
        const { error: notesErr } = await supabase
          .from("clinical_notes")
          .update({ soap_notes: cleanedSoap })
          .eq("id", visit.clinical_notes_id);
        if (notesErr) throw notesErr;
      }

      // Update prescription
      if (visit.prescription_id) {
        const validMeds = medications.filter(m => m.name.trim());
        const { error: pErr } = await supabase
          .from("prescriptions")
          .update({
            medications: validMeds,
            follow_up_date: followUpDate || null,
            notes: prescriptionNotes || null,
          })
          .eq("id", visit.prescription_id);
        if (pErr) throw pErr;

        // Regenerate prescription PDF
        await supabase.functions.invoke("generate-prescription-pdf", {
          body: { visit_id: visit.id, prescription_id: visit.prescription_id },
        }).catch(e => console.warn("PDF regeneration failed:", e));
      }

      toast.success("Visit updated successfully");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!visit) return null;

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            <FileText className="h-5 w-5 text-primary" /> Edit Notes & Prescription
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Template badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-md text-xs">Template: {templateName}</Badge>
          </div>

          {/* Clinical Notes */}
          {visit.clinical_notes_id && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Clinical Notes</Label>
              {fields.map(field => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  <Textarea
                    value={soap[field.key] || ""}
                    onChange={e => setSoap(prev => ({ ...prev, [field.key]: e.target.value }))}
                    rows={3}
                    className="rounded-lg text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Prescription */}
          {visit.prescription_id && (
            <>
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Medications</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addMed} className="rounded-lg text-xs">
                    <Plus className="mr-1 h-3 w-3" /> Add Medicine
                  </Button>
                </div>
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
                        <Input className="flex-1 min-w-[100px] h-8 rounded-md text-xs" placeholder="Duration"
                          value={med.duration} onChange={e => updateMed(i, { duration: e.target.value })} />
                      </div>
                      <Input className="rounded-md text-xs h-8" placeholder="Instructions (optional)"
                        value={med.notes} onChange={e => updateMed(i, { notes: e.target.value })} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Follow-up Date</Label>
                <Input type="date" value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)} className="rounded-lg max-w-xs" />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Prescription Notes</Label>
                <Textarea value={prescriptionNotes}
                  onChange={e => setPrescriptionNotes(e.target.value)}
                  rows={2} className="rounded-lg" />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1 rounded-lg">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
