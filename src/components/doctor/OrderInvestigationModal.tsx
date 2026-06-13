import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog, AUDIT_ACTIONS } from "@/hooks/useAuditLog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FlaskConical, Loader2 } from "lucide-react";

const COMMON_TESTS = [
  "CBC", "LFT", "RFT", "Blood Sugar (Fasting)", "Blood Sugar (Random)", "HbA1c",
  "Thyroid Profile", "Lipid Profile", "Urine Routine", "Urine Culture",
  "X-ray Chest", "X-ray Hand", "ECG", "Echo", "MRI Brain", "CT Scan",
  "Vitamin D", "Vitamin B12", "Iron Studies", "ESR", "CRP",
];

const CATEGORIES = ["Blood Test", "Scan", "Urine", "Biopsy", "Other"];

type Props = {
  open: boolean;
  onClose: () => void;
  clinicId: string;
  visitId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  clinicName: string;
  onOrdered?: () => void;
};

export default function OrderInvestigationModal({
  open, onClose, clinicId, visitId, patientId,
  doctorId, onOrdered,
}: Props) {
  const { log: auditLog } = useAuditLog();
  const [testName, setTestName] = useState("");
  const [testCategory, setTestCategory] = useState("Blood Test");
  const [urgency, setUrgency] = useState<"routine" | "urgent" | "stat">("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTestName(""); setTestCategory("Blood Test");
    setUrgency("routine"); setClinicalNotes("");
  };

  const handleSubmit = async () => {
    if (!testName.trim()) { toast.error("Please enter a test name"); return; }
    if (!testCategory) { toast.error("Please select a test category"); return; }
    setSubmitting(true);
    try {
      const { data: order, error } = await supabase
        .from("lab_orders")
        .insert({
          clinic_id: clinicId,
          visit_id: visitId,
          patient_id: patientId,
          doctor_id: doctorId,
          test_name: testName.trim(),
          test_category: testCategory,
          clinical_notes: clinicalNotes.trim() || null,
          urgency,
          status: "ordered",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`${testName} ordered successfully`);
      auditLog(AUDIT_ACTIONS.LAB_ORDER_CREATED, "lab_order", order.id, testName.trim(), { urgency });
      reset();
      onClose();
      onOrdered?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to order investigation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FlaskConical className="h-5 w-5 text-primary" /> Order Investigation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Test Name *</Label>
            <Input
              list="common-tests"
              value={testName}
              onChange={e => setTestName(e.target.value)}
              placeholder="Type or pick a common test..."
              className="rounded-lg"
            />
            <datalist id="common-tests">
              {COMMON_TESTS.map(t => <option key={t} value={t} />)}
            </datalist>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TESTS.slice(0, 8).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTestName(t)}
                  className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-primary/10 text-foreground transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={testCategory} onValueChange={setTestCategory}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={(v: any) => setUrgency(v)}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="stat">STAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Clinical Notes</Label>
            <Textarea
              rows={3}
              value={clinicalNotes}
              onChange={e => setClinicalNotes(e.target.value)}
              placeholder="Why this test is needed (suspected diagnosis, relevant history, urgency reason)..."
              className="rounded-lg"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !testName.trim()}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
