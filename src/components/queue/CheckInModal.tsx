import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export type CheckInData = {
  chief_complaint: string;
  height_cm?: number | null;
  weight_kg?: number | null;
};

type Props = {
  open: boolean;
  patientName: string;
  appointmentTime?: string;
  onClose: () => void;
  /** Called with check-in data when "Save & Move" pressed; with null when "Skip & Move". */
  onConfirm: (data: CheckInData | null) => Promise<void> | void;
};

export default function CheckInModal({ open, patientName, appointmentTime, onClose, onConfirm }: Props) {
  const [complaint, setComplaint] = useState("");
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setComplaint(""); setHeight(""); setWeight("");
  };

  const handleSkip = async () => {
    setBusy(true);
    try { await onConfirm(null); reset(); } finally { setBusy(false); }
  };

  const handleSave = async () => {
    if (!complaint.trim()) return;
    setBusy(true);
    try {
      await onConfirm({
        chief_complaint: complaint.trim(),
        height_cm: height ? Number(height) : null,
        weight_kg: weight ? Number(weight) : null,
      });
      reset();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Patient Check-in</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {patientName}{appointmentTime ? ` · ${appointmentTime}` : ""}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Chief Complaint *</Label>
            <Textarea
              rows={3}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="What brings you in today?"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Height (cm)</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="165" />
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleSkip} disabled={busy}>
            Skip & Move
          </Button>
          <Button onClick={handleSave} disabled={busy || !complaint.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save & Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
