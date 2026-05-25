import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { value: "cash", label: "💵 Cash" },
  { value: "upi", label: "📱 UPI" },
  { value: "card", label: "💳 Card" },
  { value: "insurance", label: "🏥 Insurance" },
  { value: "other", label: "🔄 Other" },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onRecorded?: () => void;
  invoice: any | null;
}

export default function RecordPaymentModal({ open, onClose, onRecorded, invoice }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<string>("cash");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    setAmount(Number(invoice.outstanding_amount) || 0);
    setMethod("cash");
    setReference("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
  }, [invoice, open]);

  if (!invoice) return null;

  const handleSubmit = async () => {
    if (!amount || amount <= 0) return toast.error("Enter valid amount");
    if (amount > Number(invoice.outstanding_amount)) return toast.error("Amount exceeds outstanding balance");
    setSaving(true);
    const { error: payErr } = await supabase.from("payments").insert({
      clinic_id: invoice.clinic_id,
      invoice_id: invoice.id,
      patient_id: invoice.patient_id,
      amount,
      payment_method: method,
      payment_date: paymentDate,
      reference_number: reference || null,
      recorded_by: user?.id || null,
    });
    if (payErr) { setSaving(false); return toast.error(payErr.message); }

    const newPaid = Number(invoice.paid_amount) + amount;
    const newOutstanding = Number(invoice.total_amount) - newPaid;
    const newStatus = newOutstanding <= 0 ? "paid" : newPaid > 0 ? "partial" : "unpaid";
    const { error: updErr } = await supabase.from("invoices").update({
      paid_amount: newPaid,
      outstanding_amount: Math.max(0, newOutstanding),
      status: newStatus,
    }).eq("id", invoice.id);
    setSaving(false);
    if (updErr) return toast.error(updErr.message);
    toast.success("Payment recorded");
    onRecorded?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-3">
          Invoice <span className="font-mono">{invoice.invoice_number}</span> · Outstanding ₹{Number(invoice.outstanding_amount).toLocaleString("en-IN")}
        </div>
        <div className="space-y-3">
          <div>
            <Label>Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="pl-7" />
            </div>
          </div>
          <div>
            <Label>Payment Method</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    "py-2.5 rounded-xl text-xs font-medium border transition-all",
                    method === m.value ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {["upi", "card", "insurance"].includes(method) && (
            <div>
              <Label>
                {method === "upi" ? "UPI Transaction ID" : method === "card" ? "Card Last 4 Digits" : "Insurance Reference / TPA ID"}
              </Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Payment Date</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : "Record Payment"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}