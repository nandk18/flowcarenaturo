import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Receipt, CreditCard, Package, MessageCircle, AlertTriangle, Printer, FileDown } from "lucide-react";
import StoreItemPicker, { type StoreItemPick } from "./StoreItemPicker";
import ServicePicker, { type ServicePick } from "./ServicePicker";
import { useClinic } from "@/hooks/useClinic";
import { openWhatsApp } from "@/lib/whatsapp";
import { downloadInvoicePdf, getInvoicePdfUrl } from "@/lib/invoicePdf";
import { createShortLink } from "@/utils/createShortLink";

import { printInvoice, buildInvoiceHtml } from "@/lib/invoiceUtils";

type LineItem = {
  name?: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total?: number;
  appointment_id?: string | null;
  gst_percentage?: number;
};

type Invoice = {
  id: string;
  clinic_id: string;
  patient_id: string;
  invoice_number: string;
  invoice_date: string | null;
  line_items: any;
  subtotal: number | null;
  gst_percentage: number | null;
  gst_amount: number | null;
  discount_amount: number | null;
  total_amount: number;
  paid_amount: number | null;
  outstanding_amount: number | null;
  status: string | null;
  notes: string | null;
  appointment_id?: string | null;
  rescheduled_from_date?: string | null;
  rescheduled_from_time?: string | null;
};

type Payment = {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string | null;
  reference_number: string | null;
  notes: string | null;
};

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  gst_percentage: number | null;
  is_default: boolean | null;
  is_active: boolean | null;
};

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  unpaid: "bg-red-100 text-red-700 border-red-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

export function fmtInvoiceDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  const parts = dt
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .split(" ");
  return parts.join("-");
}

export function fmtINR(n: number | string | null | undefined) {
  const num = Number(n) || 0;
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function normaliseItems(raw: any): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it) => ({
    name: it.name ?? it.description ?? "",
    description: it.description ?? "",
    quantity: Number(it.quantity ?? 1),
    unit_price: Number(it.unit_price ?? it.price ?? 0),
    appointment_id: it.appointment_id ?? null,
    gst_percentage: Number(it.gst_percentage ?? 0),
  }));
}

function isMultiVisit(raw: any): boolean {
  if (!Array.isArray(raw)) return false;
  const ids = raw.map((i) => i?.appointment_id).filter(Boolean);
  return new Set(ids).size > 1;
}

interface Props {
  patientId: string;
  clinicId: string;
}

export default function PatientInvoicesTab({ patientId, clinicId }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [autoPickerForId, setAutoPickerForId] = useState<string | null>(null);

  const openExisting = (id: string) => {
    setSelectedId(id);
    setCreateOpen(false);
    setAutoPickerForId(id);
  };

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Invoice[];
    // Fetch rescheduled-from info for invoices linked to an appointment
    const apptIds = Array.from(new Set(list.map((i) => i.appointment_id).filter(Boolean))) as string[];
    if (apptIds.length) {
      const { data: appts } = await (supabase as any)
        .from("appointments")
        .select("id, rescheduled_from")
        .in("id", apptIds);
      const fromIds = Array.from(new Set(((appts ?? []) as any[]).map((a) => a.rescheduled_from).filter(Boolean)));
      let oldMap = new Map<string, { d: string; t: string | null }>();
      if (fromIds.length) {
        const { data: olds } = await (supabase as any)
          .from("appointments")
          .select("id, appointment_date, appointment_time")
          .in("id", fromIds);
        oldMap = new Map(((olds ?? []) as any[]).map((o) => [o.id, { d: o.appointment_date, t: o.appointment_time }]));
      }
      const apptToFrom = new Map(((appts ?? []) as any[]).map((a) => [a.id, a.rescheduled_from]));
      list.forEach((inv) => {
        if (!inv.appointment_id) return;
        const fromId = apptToFrom.get(inv.appointment_id);
        if (!fromId) return;
        const old = oldMap.get(fromId);
        if (old) { inv.rescheduled_from_date = old.d; inv.rescheduled_from_time = old.t; }
      });
    }
    setInvoices(list);
    if (!selectedId && list.length) setSelectedId(list[0].id);
  }, [patientId, clinicId, selectedId]);

  useEffect(() => {
    load();
    supabase
      .from("invoice_services")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .then(({ data }) => setServices((data ?? []) as ServiceRow[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, clinicId]);

  const selected = invoices.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-10">
      {/* LEFT: invoice list */}
      <aside className="lg:col-span-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold flex items-center gap-1.5">
            <Receipt className="h-4 w-4" /> Invoices
          </h3>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create
          </Button>
        </div>
        <div className="space-y-2 max-h-[640px] overflow-y-auto">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">No invoices yet</p>
          ) : (
            invoices.map((i) => (
              <button
                key={i.id}
                onClick={() => setSelectedId(i.id)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition hover:bg-accent",
                  selectedId === i.id && "border-primary bg-accent"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{i.invoice_number}</span>
                  <span className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                    STATUS_STYLES[i.status ?? "unpaid"] ?? STATUS_STYLES.unpaid
                  )}>{i.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{fmtInvoiceDate(i.invoice_date)}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{fmtINR(i.total_amount)}</p>
                  <div className="flex gap-1">
                    {i.rescheduled_from_date && (
                      <span
                        title={`Originally ${i.rescheduled_from_date}${i.rescheduled_from_time ? " at " + i.rescheduled_from_time.slice(0, 5) : ""}`}
                        className="inline-flex rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase"
                      >
                        Rescheduled
                      </span>
                    )}
                    {isMultiVisit(i.line_items) && (
                      <span className="inline-flex rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold uppercase">
                        Multi-visit
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* RIGHT: detail */}
      <section className="lg:col-span-7 rounded-2xl border bg-card p-6 shadow-sm">
        {!selected ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
            Select an invoice to view
          </div>
        ) : (
          <InvoiceDetail
            key={selected.id}
            invoice={selected}
            onChanged={load}
            patientId={patientId}
            clinicId={clinicId}
            autoOpenPicker={autoPickerForId === selected.id}
            onPickerHandled={() => setAutoPickerForId(null)}
          />
        )}
      </section>

      <CreateInvoiceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
        patientId={patientId}
        clinicId={clinicId}
        services={services}
        onOpenExisting={openExisting}
      />
    </div>
  );
}

/* ============== DETAIL ============== */

function InvoiceDetail({ invoice, onChanged, patientId, clinicId, autoOpenPicker, onPickerHandled }: { invoice: Invoice; onChanged: () => void; patientId: string; clinicId: string; autoOpenPicker?: boolean; onPickerHandled?: () => void }) {
  const { clinic } = useClinic();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [services, setServices] = useState<ServiceRow[]>([]);
  useEffect(() => {
    supabase
      .from("invoice_services")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .then(({ data }) => setServices((data ?? []) as ServiceRow[]));
  }, [clinicId]);

  useEffect(() => {
    if (autoOpenPicker) {
      setPickerOpen(true);
      onPickerHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenPicker]);
  const [items, setItems] = useState<LineItem[]>(normaliseItems(invoice.line_items));
  const [gstPct, setGstPct] = useState(Number(invoice.gst_percentage) || 0);
  const [discount, setDiscount] = useState(Number(invoice.discount_amount) || 0);
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [status, setStatus] = useState(invoice.status ?? "unpaid");
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    setItems(normaliseItems(invoice.line_items));
    setGstPct(Number(invoice.gst_percentage) || 0);
    setDiscount(Number(invoice.discount_amount) || 0);
    setNotes(invoice.notes ?? "");
    setStatus(invoice.status ?? "unpaid");
  }, [invoice]);

  const loadPayments = useCallback(async () => {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("payment_date", { ascending: false });
    setPayments((data ?? []) as Payment[]);
  }, [invoice.id]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
    const afterDisc = Math.max(0, subtotal - (discount || 0));
    const gstAmount = +(afterDisc * (gstPct || 0) / 100).toFixed(2);
    const total = +(afterDisc + gstAmount).toFixed(2);
    const outstanding = Math.max(0, total - Number(invoice.paid_amount || 0));
    return { subtotal, gstAmount, total, outstanding };
  }, [items, gstPct, discount, invoice.paid_amount]);

  const updateStatus = async (newStatus: string) => {
    setStatus(newStatus);
    const { error } = await supabase
      .from("invoices")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", invoice.id);
    if (error) toast.error(error.message); else { toast.success("Status updated"); onChanged(); }
  };

  const saveAll = async () => {
    setSaving(true);
    const { error } = await supabase.from("invoices").update({
      line_items: items as any,
      subtotal: totals.subtotal,
      gst_percentage: gstPct,
      gst_amount: totals.gstAmount,
      discount_amount: discount,
      total_amount: totals.total,
      outstanding_amount: totals.outstanding,
      notes: notes || null,
      pdf_url: null,
      pdf_generated_at: null,
      updated_at: new Date().toISOString(),
    } as any).eq("id", invoice.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice saved");
    onChanged();
  };

  const addStoreItem = (s: StoreItemPick) => {
    setItems((cur) => [...cur, {
      name: s.name,
      description: s.description ?? "",
      quantity: 1,
      unit_price: Number(s.unit_price),
      gst_percentage: Number(s.gst_percentage ?? 0),
      appointment_id: null,
    }]);
  };
  const addServicePick = (s: ServicePick) => {
    setItems((cur) => [...cur, {
      name: s.name,
      description: s.description ?? "",
      quantity: 1,
      unit_price: Number(s.amount),
      gst_percentage: Number(s.gst_percentage ?? 0),
      appointment_id: null,
    }]);
  };
  const addEmptyRow = () => {
    setItems((cur) => [...cur, { name: "", description: "", quantity: 1, unit_price: 0, appointment_id: null }]);
  };
  const updateItem = (idx: number, field: keyof LineItem, v: any) => {
    const next = [...items];
    (next[idx] as any)[field] = field === "name" || field === "description" ? v : Number(v);
    setItems(next);
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const distinctAppointments = new Set(items.map((i) => i.appointment_id).filter(Boolean));
  const showAppointmentGroups = distinctAppointments.size > 1;

  const loadFullInvoice = async () => {
    if (!invoice?.id) {
      console.error("[invoice] missing invoice.id", invoice);
      return null;
    }
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice.id)
      .maybeSingle();
    if (error || !inv) {
      console.error("[invoice] load failed", error);
      toast.error(error?.message || "Invoice not found");
      return null;
    }
    const [{ data: patient }, { data: doctor }] = await Promise.all([
      supabase.from("patients").select("id,name,healthcare_id,phone,email").eq("id", inv.patient_id).maybeSingle(),
      inv.doctor_id
        ? supabase.from("doctors").select("id,name").eq("id", inv.doctor_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    return { ...inv, patients: patient, doctors: doctor };
  };

  const handlePrint = async () => {
    const full = await loadFullInvoice();
    if (!full) return toast.error("Failed to load invoice");
    printInvoice(buildInvoiceHtml(full, clinic));
  };

  const handleDownload = async () => {
    const full = await loadFullInvoice();
    if (!full) return toast.error("Failed to load invoice");
    downloadInvoicePdf(full, clinic);
    toast.success("Invoice downloaded");
  };

  const sendWhatsApp = async () => {
    const full = await loadFullInvoice();
    if (!full) return toast.error("Failed to load invoice");
    const phone = full.patients?.phone;
    if (!phone) return toast.error("No phone number found for this patient");
    toast.loading("Generating PDF…", { id: "pdf-share" });
    let pdfUrl = "";
    try {
      const rawUrl = await getInvoicePdfUrl(full, clinic);
      pdfUrl = await createShortLink(rawUrl, clinicId, "invoice", null);
      toast.success("PDF ready", { id: "pdf-share" });
    } catch (e: any) {
      return toast.error(e?.message || "Failed to generate PDF", { id: "pdf-share" });
    }
    const clinicName = clinic?.name ?? "";
    const message =
      `Dear ${full.patients?.name ?? ""},\n\n` +
      `Your invoice ${full.invoice_number} from ${clinicName} is ready.\n\n` +
      `Total: ${fmtINR(full.total_amount)}\n` +
      `Status: ${(full.status || "unpaid").toUpperCase()}\n\n` +
      `View invoice: ${pdfUrl}\n\n` +
      `Thank you for visiting ${clinicName}!`;
    openWhatsApp(phone, message);

  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{invoice.invoice_number}</h2>
          <p className="text-sm text-muted-foreground mt-1">{fmtInvoiceDate(invoice.invoice_date)}</p>
        </div>
        <div className="w-44">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={updateStatus}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-sm">Line Items</h4>
        </div>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium w-16 text-center">Qty</th>
                <th className="px-3 py-2 font-medium w-28 text-right">Unit Price</th>
                <th className="px-3 py-2 font-medium w-28 text-right">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No items</td></tr>
              ) : items.map((it, idx) => {
                const prevAppt = idx > 0 ? items[idx - 1].appointment_id : undefined;
                const showGroupHeader = showAppointmentGroups && it.appointment_id && it.appointment_id !== prevAppt;
                const groupIdx = showAppointmentGroups && it.appointment_id
                  ? Array.from(distinctAppointments).indexOf(it.appointment_id) + 1
                  : 0;
                return (
                  <React.Fragment key={idx}>
                    {showGroupHeader && (
                      <tr key={`grp-${idx}`} className="bg-blue-50/60 border-t">
                        <td colSpan={6} className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                          Visit {groupIdx}
                        </td>
                      </tr>
                    )}
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1">
                        <Input value={it.name ?? ""} onChange={(e) => updateItem(idx, "name", e.target.value)} className="h-8 border-0 focus-visible:ring-1" />
                      </td>
                      <td className="px-2 py-1">
                        <Input value={it.description ?? ""} onChange={(e) => updateItem(idx, "description", e.target.value)} className="h-8 border-0 focus-visible:ring-1" />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="h-8 text-center border-0 focus-visible:ring-1" />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" min={0} value={it.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} className="h-8 text-right border-0 focus-visible:ring-1" />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{fmtINR(Number(it.quantity) * Number(it.unit_price))}</td>
                      <td className="px-2 py-2 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <Button variant="outline" size="sm" onClick={() => setServiceOpen(true)}>
            <Receipt className="h-3.5 w-3.5 mr-1" /> Add Service
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Package className="h-3.5 w-3.5 mr-1" /> Add Store Item
          </Button>
          <Button variant="outline" size="sm" onClick={addEmptyRow}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Empty Row
          </Button>
        </div>
      </div>

      {/* Financials */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
          <div className="flex justify-between"><span>Subtotal</span><span>{fmtINR(totals.subtotal)}</span></div>
          <div className="flex justify-between items-center">
            <span>GST %</span>
            <Input type="number" min={0} max={100} value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} className="w-24 h-8" />
          </div>
          <div className="flex justify-between"><span>GST Amount</span><span>{fmtINR(totals.gstAmount)}</span></div>
          <div className="flex justify-between items-center">
            <span>Discount</span>
            <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-24 h-8" />
          </div>
          <div className="flex justify-between pt-2 border-t font-bold text-base">
            <span>Total</span><span>{fmtINR(totals.total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Paid</span><span>{fmtINR(invoice.paid_amount)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-amber-700">
            <span>Outstanding</span><span>{fmtINR(totals.outstanding)}</span>
          </div>
        </div>

        {/* Payments */}
        <div className="rounded-lg border p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">Payments</h4>
            <Button size="sm" variant="outline" onClick={() => setPayOpen(true)} disabled={totals.outstanding <= 0}>
              <CreditCard className="h-3.5 w-3.5 mr-1" /> Record Payment
            </Button>
          </div>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-xs text-center py-4">No payments recorded</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {payments.map((p) => (
                <li key={p.id} className="rounded-md border bg-background p-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{fmtINR(p.amount)}</span>
                    <span className="text-xs uppercase text-muted-foreground">{p.payment_method}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {fmtInvoiceDate(p.payment_date)}{p.reference_number ? ` · Ref ${p.reference_number}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Invoice notes" rows={3} />
      </div>

      <div className="flex justify-end gap-2 flex-wrap">
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
        <Button variant="outline" onClick={handleDownload}>
          <FileDown className="h-4 w-4 mr-1" /> Download PDF
        </Button>
        <Button variant="outline" onClick={sendWhatsApp}>
          <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
        </Button>
        <Button onClick={saveAll} disabled={saving}>{saving ? "Saving..." : "Save Invoice"}</Button>
      </div>

      <RecordPaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        invoice={invoice}
        outstanding={totals.outstanding}
        onRecorded={() => { loadPayments(); onChanged(); }}
      />
      <StoreItemPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        clinicId={clinicId}
        onPick={addStoreItem}
      />
      <ServicePicker
        open={serviceOpen}
        onClose={() => setServiceOpen(false)}
        clinicId={clinicId}
        onPick={addServicePick}
      />
    </div>
  );
}

/* ============== RECORD PAYMENT ============== */

function RecordPaymentDialog({
  open, onClose, invoice, outstanding, onRecorded,
}: {
  open: boolean; onClose: () => void; invoice: Invoice; outstanding: number; onRecorded: () => void;
}) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(outstanding);
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(outstanding);
      setMethod("cash");
      setDate(new Date().toISOString().slice(0, 10));
      setRef(""); setNotes("");
    }
  }, [open, outstanding]);

  const submit = async () => {
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    const { error: payErr } = await supabase.from("payments").insert({
      clinic_id: invoice.clinic_id,
      invoice_id: invoice.id,
      patient_id: invoice.patient_id,
      amount,
      payment_method: method,
      payment_date: date,
      reference_number: ref || null,
      notes: notes || null,
      recorded_by: user?.id || null,
    });
    if (payErr) { setSaving(false); return toast.error(payErr.message); }

    const newPaid = Number(invoice.paid_amount || 0) + amount;
    const newOut = Math.max(0, Number(invoice.total_amount) - newPaid);
    const newStatus = newOut <= 0 ? "paid" : newPaid > 0 ? "partial" : "unpaid";
    const { error: updErr } = await supabase.from("invoices").update({
      paid_amount: newPaid,
      outstanding_amount: newOut,
      status: newStatus,
    }).eq("id", invoice.id);
    setSaving(false);
    if (updErr) return toast.error(updErr.message);
    toast.success("Payment recorded");
    onRecorded();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <div className="text-xs text-muted-foreground">
          Invoice {invoice.invoice_number} · Outstanding {fmtINR(outstanding)}
        </div>
        <div className="space-y-3 mt-2">
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Reference Number</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Payment"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============== CREATE INVOICE ============== */

function CreateInvoiceModal({
  open, onClose, onCreated, patientId, clinicId, services, onOpenExisting,
}: {
  open: boolean; onClose: () => void; onCreated: () => void;
  patientId: string; clinicId: string; services: ServiceRow[];
  onOpenExisting?: (invoiceId: string) => void;
}) {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<LineItem[]>([]);
  const [gstPct, setGstPct] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("unpaid");
  const [saving, setSaving] = useState(false);
  const [existingTodayId, setExistingTodayId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(new Date().toISOString().slice(0, 10));
    setItems([]); setGstPct(0); setDiscount(0); setNotes(""); setStatus("unpaid");
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from("invoices")
      .select("id")
      .eq("patient_id", patientId)
      .eq("invoice_date", today)
      .eq("status", "unpaid")
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => setExistingTodayId(data?.[0]?.id ?? null));
  }, [open, patientId]);

  const addService = (id: string) => {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    setItems((cur) => [...cur, {
      name: s.name,
      description: s.description ?? "",
      quantity: 1,
      unit_price: Number(s.amount),
    }]);
    if (items.length === 0 && s.gst_percentage != null) setGstPct(Number(s.gst_percentage));
  };

  const addItem = () => setItems([...items, { name: "", description: "", quantity: 1, unit_price: 0 }]);
  const updateItem = (idx: number, field: keyof LineItem, v: any) => {
    const next = [...items];
    (next[idx] as any)[field] = field === "name" || field === "description" ? v : Number(v);
    setItems(next);
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
    const afterDisc = Math.max(0, subtotal - (discount || 0));
    const gstAmount = +(afterDisc * (gstPct || 0) / 100).toFixed(2);
    const total = +(afterDisc + gstAmount).toFixed(2);
    return { subtotal, gstAmount, total };
  }, [items, gstPct, discount]);

  const submit = async () => {
    if (!items.length) return toast.error("Add at least one line item");
    setSaving(true);
    const { error } = await supabase.from("invoices").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      invoice_number: "PENDING",
      invoice_date: date,
      line_items: items as any,
      subtotal: totals.subtotal,
      gst_percentage: gstPct,
      gst_amount: totals.gstAmount,
      discount_amount: discount,
      total_amount: totals.total,
      paid_amount: 0,
      outstanding_amount: totals.total,
      status,
      notes: notes || null,
      created_by: user?.id || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice created");
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
        {existingTodayId && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            <div className="flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">An unpaid invoice already exists for today.</p>
                <p className="text-xs text-amber-800 mt-0.5">Do you want to add to the existing invoice instead?</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => onOpenExisting?.(existingTodayId)}>
                    Add to Existing
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setExistingTodayId(null)}>
                    Create New Invoice
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Invoice Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Add Service</Label>
            <Select value="" onValueChange={addService}>
              <SelectTrigger><SelectValue placeholder="Select a service to add" /></SelectTrigger>
              <SelectContent>
                {services.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">No services configured</div>}
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — ₹{Number(s.amount).toLocaleString("en-IN")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-semibold">Line Items</h4>
            <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 w-16 text-center">Qty</th>
                  <th className="px-3 py-2 w-28 text-right">Unit Price</th>
                  <th className="px-3 py-2 w-28 text-right">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No items — pick a service or add manually</td></tr>
                ) : items.map((it, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-2 py-1"><Input value={it.name ?? ""} onChange={(e) => updateItem(idx, "name", e.target.value)} className="h-8" /></td>
                    <td className="px-2 py-1"><Input value={it.description ?? ""} onChange={(e) => updateItem(idx, "description", e.target.value)} className="h-8" /></td>
                    <td className="px-2 py-1"><Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="h-8 text-center" /></td>
                    <td className="px-2 py-1"><Input type="number" min={0} value={it.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} className="h-8 text-right" /></td>
                    <td className="px-3 py-2 text-right">{fmtINR(Number(it.quantity) * Number(it.unit_price))}</td>
                    <td className="px-2 py-2 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 mt-3">
          <div className="space-y-2">
            <div>
              <Label>GST %</Label>
              <Input type="number" min={0} max={100} value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} />
            </div>
            <div>
              <Label>Discount (₹)</Label>
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2 self-start">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmtINR(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>− {fmtINR(discount)}</span></div>
            <div className="flex justify-between"><span>GST ({gstPct}%)</span><span>{fmtINR(totals.gstAmount)}</span></div>
            <div className="flex justify-between pt-2 border-t font-bold text-base"><span>Total</span><span>{fmtINR(totals.total)}</span></div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create Invoice"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
