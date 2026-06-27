import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/billing/StatusBadge";
import RecordPaymentModal from "@/components/billing/RecordPaymentModal";
import { Printer, Share2, Plus, XCircle, ArrowLeft, FileDown } from "lucide-react";
import { toast } from "sonner";
import { openWhatsApp, buildInvoiceMessage } from "@/lib/whatsapp";
import { printInvoice, buildInvoiceHtml } from "@/lib/invoiceUtils";
import { downloadInvoicePdf, getInvoicePdfUrl } from "@/lib/invoicePdf";
import PatientLink from "@/components/PatientLink";

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { clinic } = useClinic();
  const role = profile?.role;
  const canWrite = role === "admin";
  const [invoice, setInvoice] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [payOpen, setPayOpen] = useState(false);

  const load = async () => {
    if (!invoiceId) return;
    const { data } = await supabase.from("invoices")
      .select(`*,patients(id,name,healthcare_id,phone,email),doctors(id,name),visits(id,chief_complaint)`)
      .eq("id", invoiceId).single();
    setInvoice(data);
    const { data: pays } = await supabase.from("payments").select("*").eq("invoice_id", invoiceId).order("payment_date", { ascending: false });
    setPayments(pays || []);
  };

  useEffect(() => { load(); }, [invoiceId]);

  const handleCancel = async () => {
    if (!confirm("Cancel this invoice? This cannot be undone.")) return;
    const { error } = await supabase.from("invoices").update({ status: "cancelled" }).eq("id", invoiceId!);
    if (error) return toast.error(error.message);
    toast.success("Invoice cancelled");
    load();
  };

  const share = async () => {
    if (!invoice) return;
    let pdfUrl = "";
    try {
      toast.loading("Preparing invoice PDF…", { id: "share-pdf" });
      pdfUrl = await getInvoicePdfUrl(invoice, clinic);
      toast.success("PDF ready", { id: "share-pdf" });
    } catch (e: any) {
      toast.error(e?.message || "Failed to prepare PDF", { id: "share-pdf" });
      return;
    }
    const phone = invoice.patients?.phone?.replace(/\D/g, "");
    if (!phone) { navigator.clipboard.writeText(pdfUrl); toast.success("PDF link copied"); return; }
    openWhatsApp(
      invoice.patients?.phone,
      buildInvoiceMessage(
        invoice.patients?.name,
        invoice.invoice_number,
        Number(invoice.total_amount),
        invoice.status,
        invoice.id,
        clinic?.name || ""
      ).replace(`${window.location.origin}/invoice/${invoice.id}`, pdfUrl)
    );
  };

  if (!invoice) return <DashboardLayout><div className="p-8 text-sm text-muted-foreground">Loading…</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/billing")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>

        <Card className="p-6 print:shadow-none">
          <div className="flex justify-between items-start gap-4 border-b pb-4 mb-4">
            <div>
              {clinic?.logo_url && <img src={clinic.logo_url} alt={clinic.name} className="h-12 mb-2" />}
              <h1 className="font-bold text-lg">{clinic?.name}</h1>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{clinic?.address}</p>
              <p className="text-xs text-muted-foreground">{clinic?.phone}</p>
              {(clinic as any)?.gst_number && <p className="text-xs">GSTIN: {(clinic as any).gst_number}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-muted-foreground">Invoice</p>
              <p className="font-mono font-bold">{invoice.invoice_number}</p>
              <p className="text-xs">{new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</p>
              <div className="mt-1"><StatusBadge status={invoice.status} /></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground mb-1">Bill To</p>
              {invoice.patients && <PatientLink patientId={invoice.patients.id} className="font-semibold">{invoice.patients.name}</PatientLink>}
              <p className="text-xs text-primary">{invoice.patients?.healthcare_id}</p>
              <p className="text-xs text-muted-foreground">{invoice.patients?.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-muted-foreground mb-1">Doctor</p>
              <p>{invoice.doctors?.name || "—"}</p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr>
                <th className="text-left p-2">Description</th>
                <th className="text-center p-2 w-16">Qty</th>
                <th className="text-right p-2 w-24">Unit</th>
                <th className="text-right p-2 w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.line_items as any[])?.map((li, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{li.description}</td>
                  <td className="text-center p-2">{li.quantity}</td>
                  <td className="text-right p-2">₹{Number(li.unit_price).toLocaleString("en-IN")}</td>
                  <td className="text-right p-2">₹{(Number(li.quantity) * Number(li.unit_price)).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mt-4">
            <div className="w-64 text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>₹{Number(invoice.subtotal).toLocaleString("en-IN")}</span></div>
              {Number(invoice.discount_amount) > 0 && <div className="flex justify-between"><span>Discount</span><span>−₹{Number(invoice.discount_amount).toLocaleString("en-IN")}</span></div>}
              {Number(invoice.gst_amount) > 0 && <div className="flex justify-between"><span>GST ({invoice.gst_percentage}%)</span><span>₹{Number(invoice.gst_amount).toLocaleString("en-IN")}</span></div>}
              <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>₹{Number(invoice.total_amount).toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between text-green-600"><span>Paid</span><span>₹{Number(invoice.paid_amount).toLocaleString("en-IN")}</span></div>
              {Number(invoice.outstanding_amount) > 0 && <div className="flex justify-between text-destructive font-semibold"><span>Outstanding</span><span>₹{Number(invoice.outstanding_amount).toLocaleString("en-IN")}</span></div>}
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-4 border-t pt-3 text-sm">
              <p className="text-xs uppercase text-muted-foreground">Notes</p>
              <p>{invoice.notes}</p>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Payment History</h3>
          {payments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No payments recorded yet</p>
          ) : (
            <div className="space-y-2 text-sm">
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between border-b pb-1">
                  <div>
                    <p className="font-medium capitalize">{p.payment_method}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.payment_date).toLocaleDateString("en-IN")} {p.reference_number ? `· ${p.reference_number}` : ""}</p>
                  </div>
                  <p className="font-semibold">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex gap-2 flex-wrap print:hidden">
          {invoice.status !== "paid" && invoice.status !== "cancelled" && canWrite && (
            <Button onClick={() => setPayOpen(true)}><Plus className="w-4 h-4 mr-1" /> Record Payment</Button>
          )}
          <Button variant="outline" onClick={share}><Share2 className="w-4 h-4 mr-1" /> Share</Button>
          <Button variant="outline" onClick={() => printInvoice(buildInvoiceHtml(invoice, clinic))}><Printer className="w-4 h-4 mr-1" /> Print</Button>
          <Button variant="outline" onClick={() => downloadInvoicePdf(invoice, clinic)}><FileDown className="w-4 h-4 mr-1" /> Download PDF</Button>
          {role === "admin" && invoice.status !== "cancelled" && (
            <Button variant="destructive" onClick={handleCancel}><XCircle className="w-4 h-4 mr-1" /> Cancel Invoice</Button>
          )}
        </div>
      </div>

      <RecordPaymentModal open={payOpen} onClose={() => setPayOpen(false)} onRecorded={load} invoice={invoice} />
    </DashboardLayout>
  );
}