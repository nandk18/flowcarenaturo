import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Trash2, Plus, Receipt } from "lucide-react";
import ServicePicker, { type ServicePick } from "./ServicePicker";

type LineItem = { description: string; quantity: number; unit_price: number };

const QUICK_ITEMS: LineItem[] = [
  { description: "Consultation Fee", quantity: 1, unit_price: 500 },
  { description: "Follow-up Consultation", quantity: 1, unit_price: 300 },
  { description: "Procedure Fee", quantity: 1, unit_price: 1000 },
  { description: "Report / Certificate Fee", quantity: 1, unit_price: 200 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  clinicId: string;
  defaultPatientId?: string;
  defaultVisitId?: string;
  defaultDoctorId?: string;
  defaultItems?: LineItem[];
  clinicGstPercentage?: number;
}

export default function CreateInvoiceModal({
  open, onClose, onCreated, clinicId,
  defaultPatientId, defaultVisitId, defaultDoctorId, defaultItems,
  clinicGstPercentage = 0,
}: Props) {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patientId, setPatientId] = useState<string>(defaultPatientId || "");
  const [patientSearch, setPatientSearch] = useState("");
  const [doctorId, setDoctorId] = useState<string>(defaultDoctorId || "");
  const [visitId] = useState<string | undefined>(defaultVisitId);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [lineItems, setLineItems] = useState<LineItem[]>(defaultItems || []);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [gstPercentage, setGstPercentage] = useState(clinicGstPercentage);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPatientId(defaultPatientId || "");
    setDoctorId(defaultDoctorId || "");
    setLineItems(defaultItems && defaultItems.length ? defaultItems : []);
    setDiscountAmount(0);
    setGstPercentage(clinicGstPercentage);
    setNotes("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    // load doctors and recent patients
    supabase.from("doctors").select("id,name").eq("clinic_id", clinicId).then(({ data }) => setDoctors(data || []));
    supabase
      .from("patients")
      .select("id,name,healthcare_id,phone")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setPatients(data || []));
  }, [open, clinicId, defaultPatientId, defaultDoctorId, defaultItems, clinicGstPercentage]);

  useEffect(() => {
    if (!patientSearch || patientSearch.length < 2) return;
    const t = setTimeout(() => {
      supabase
        .from("patients")
        .select("id,name,healthcare_id,phone")
        .eq("clinic_id", clinicId)
        .or(`name.ilike.%${patientSearch}%,healthcare_id.ilike.%${patientSearch}%,phone.ilike.%${patientSearch}%`)
        .limit(15)
        .then(({ data }) => setPatients(data || []));
    }, 250);
    return () => clearTimeout(t);
  }, [patientSearch, clinicId]);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const afterDiscount = Math.max(0, subtotal - (discountAmount || 0));
    const gstAmount = (afterDiscount * (gstPercentage || 0)) / 100;
    const total = afterDiscount + gstAmount;
    return { subtotal, gstAmount, total };
  }, [lineItems, discountAmount, gstPercentage]);

  const addItem = (item?: LineItem) =>
    setLineItems([...lineItems, item || { description: "", quantity: 1, unit_price: 0 }]);
  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    const next = [...lineItems];
    (next[idx] as any)[field] = field === "description" ? value : Number(value);
    setLineItems(next);
  };
  const removeItem = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!patientId) return toast.error("Select a patient");
    if (!lineItems.length) return toast.error("Add at least one item");
    if (lineItems.some((i) => !i.description.trim() || i.unit_price <= 0 || i.quantity <= 0))
      return toast.error("Fill in all line items correctly");
    setSaving(true);
    const { data, error } = await supabase
      .from("invoices")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        visit_id: visitId || null,
        doctor_id: doctorId || null,
        invoice_date: invoiceDate,
        invoice_number: "PENDING", // overwritten by trigger
        line_items: lineItems as any,
        subtotal: totals.subtotal,
        gst_percentage: gstPercentage || 0,
        gst_amount: totals.gstAmount,
        discount_amount: discountAmount || 0,
        total_amount: totals.total,
        paid_amount: 0,
        outstanding_amount: totals.total,
        status: "unpaid",
        notes: notes || null,
        created_by: user?.id || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Invoice ${data.invoice_number} created`);
    onCreated?.();
    onClose();
  };

  const selectedPatient = patients.find((p) => p.id === patientId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Patient</Label>
            {selectedPatient && !defaultPatientId ? (
              <div className="mt-1 flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{selectedPatient.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedPatient.healthcare_id}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPatientId("")}>Change</Button>
              </div>
            ) : selectedPatient ? (
              <div className="mt-1 rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">{selectedPatient.name}</p>
                <p className="text-xs text-muted-foreground">{selectedPatient.healthcare_id}</p>
              </div>
            ) : (
              <>
                <Input placeholder="Search patient by name / ID / phone" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPatientId(p.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0"
                    >
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.healthcare_id} · {p.phone}</p>
                    </button>
                  ))}
                  {patients.length === 0 && <p className="px-3 py-4 text-xs text-muted-foreground">No patients found</p>}
                </div>
              </>
            )}
          </div>
          <div>
            <Label>Doctor</Label>
            <select className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">— None —</option>
              {doctors.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
            <Label className="mt-3 block">Invoice Date</Label>
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Line Items</h4>
            <div className="flex gap-1 flex-wrap">
              {QUICK_ITEMS.map((q) => (
                <Button key={q.description} type="button" size="sm" variant="outline" onClick={() => addItem({ ...q })}>
                  + {q.description} ₹{q.unit_price}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {lineItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Description" className="flex-1" />
                <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="w-16 text-center" />
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                  <Input type="number" min={0} value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} className="pl-7" />
                </div>
                <div className="w-24 text-right text-sm font-medium">₹{(item.quantity * item.unit_price).toLocaleString("en-IN")}</div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} aria-label="Remove item">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => addItem()}>
            <Plus className="w-3 h-3 mr-1" /> Add Item
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" rows={4} />
          </div>
          <div className="rounded-lg border p-4 text-sm space-y-2 bg-muted/30">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{totals.subtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between items-center">
              <span>Discount</span>
              <div className="relative w-28">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input type="number" min={0} value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} className="pl-7 h-8" />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span>GST %</span>
              <Input type="number" min={0} max={100} value={gstPercentage} onChange={(e) => setGstPercentage(Number(e.target.value))} className="w-28 h-8" />
            </div>
            <div className="flex justify-between"><span>GST Amount</span><span>₹{totals.gstAmount.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between pt-2 border-t font-bold text-base"><span>Total</span><span>₹{totals.total.toLocaleString("en-IN")}</span></div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Creating..." : "Create Invoice"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}