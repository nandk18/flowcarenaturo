import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog, AUDIT_ACTIONS } from "@/hooks/useAuditLog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FlaskConical, Loader2 } from "lucide-react";

const COMMON_TESTS = [
  "CBC", "LFT", "RFT", "Blood Sugar (Fasting)", "Blood Sugar (Random)", "HbA1c",
  "Thyroid Profile", "Lipid Profile", "Urine Routine", "Urine Culture",
  "X-ray Chest", "X-ray Hand", "ECG", "Echo", "MRI Brain", "CT Scan",
  "Vitamin D", "Vitamin B12", "Iron Studies", "ESR", "CRP",
];

const CATEGORIES = ["Blood Test", "Scan", "Urine", "Biopsy", "Other"];

type Lab = { id: string; name: string; email: string | null };

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
  open, onClose, clinicId, visitId, patientId, patientName,
  doctorId, doctorName, clinicName, onOrdered,
}: Props) {
  const [labs, setLabs] = useState<(Lab & { type?: string })[]>([]);
  const [testName, setTestName] = useState("");
  const [testCategory, setTestCategory] = useState("Blood Test");
  const [selectedLabId, setSelectedLabId] = useState<string>("");
  const [urgency, setUrgency] = useState<"routine" | "urgent" | "stat">("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [sendNotification, setSendNotification] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !clinicId) return;
    (async () => {
      // Internal labs owned by this clinic
      const { data: internal } = await supabase
        .from("labs")
        .select("id, name, email, type")
        .eq("clinic_id", clinicId)
        .eq("type", "internal");
      // External labs this clinic has linked
      const { data: links } = await supabase
        .from("clinic_labs")
        .select("labs(id, name, email, type)")
        .eq("clinic_id", clinicId);
      const external = (links || []).map((l: any) => l.labs).filter(Boolean);
      const merged = [
        ...(internal || []).map((l: any) => ({ ...l, type: "internal" })),
        ...external.map((l: any) => ({ ...l, type: "external" })),
      ];
      setLabs(merged);
    })();
  }, [open, clinicId]);

  const reset = () => {
    setTestName(""); setTestCategory("Blood Test"); setSelectedLabId("");
    setUrgency("routine"); setClinicalNotes(""); setSendNotification(true);
  };

  const selectedLab = labs.find(l => l.id === selectedLabId) || null;

  const handleSubmit = async () => {
    if (!testName.trim()) { toast.error("Please enter a test name"); return; }
    if (!selectedLabId) { toast.error("Please select a lab before ordering"); return; }
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
          lab_id: selectedLab?.id || null,
          test_name: testName.trim(),
          test_category: testCategory,
          clinical_notes: clinicalNotes.trim() || null,
          urgency,
          status: "ordered",
        })
        .select()
        .single();

      if (error) throw error;

      if (selectedLab?.email && sendNotification) {
        // Best-effort: don't block on email errors
        supabase.functions.invoke("send-lab-order", {
          body: {
            lab_order_id: order.id,
            lab_email: selectedLab.email,
            patient_name: patientName,
            test_name: testName.trim(),
            urgency,
            clinical_notes: clinicalNotes.trim() || "",
            doctor_name: doctorName,
            clinic_name: clinicName,
          },
        }).catch(e => console.warn("Email notification failed:", e));
      }

      toast.success(`${testName} ordered successfully`);
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
            <Label>Send to Lab <span className="text-destructive">*</span></Label>
            <Select value={selectedLabId} onValueChange={setSelectedLabId}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select a lab..." />
              </SelectTrigger>
              <SelectContent>
                {labs.filter(l => l.type === "internal").length > 0 && (
                  <div className="px-2 py-1 text-[10px] uppercase font-semibold text-muted-foreground">Internal Labs</div>
                )}
                {labs.filter(l => l.type === "internal").map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    🏥 {l.name}{l.email && <span className="text-muted-foreground"> · {l.email}</span>}
                  </SelectItem>
                ))}
                {labs.filter(l => l.type === "external").length > 0 && (
                  <div className="px-2 py-1 text-[10px] uppercase font-semibold text-muted-foreground">External Labs</div>
                )}
                {labs.filter(l => l.type === "external").map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    🌐 {l.name}{l.email && <span className="text-muted-foreground"> · {l.email}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {labs.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No labs available yet. Add labs in Settings → Labs (or browse the Lab Directory).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Clinical Notes for Lab</Label>
            <Textarea
              rows={3}
              value={clinicalNotes}
              onChange={e => setClinicalNotes(e.target.value)}
              placeholder="Why this test is needed (suspected diagnosis, relevant history, urgency reason)..."
              className="rounded-lg"
            />
          </div>

          {selectedLab?.email && (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <div>
                <Label className="text-sm">Notify lab by email</Label>
                <p className="text-xs text-muted-foreground">Send order details to {selectedLab.email}</p>
              </div>
              <Switch checked={sendNotification} onCheckedChange={setSendNotification} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !testName.trim() || !selectedLabId}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ordering...</> : "Send Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
