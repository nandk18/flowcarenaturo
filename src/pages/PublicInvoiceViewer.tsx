import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StatusBadge from "@/components/billing/StatusBadge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function PublicInvoiceViewer() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);

  useEffect(() => {
    if (!invoiceId) return;
    (async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-public-invoice?id=${encodeURIComponent(invoiceId)}`;
      try {
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.invoice) return;
        setInvoice({ ...data.invoice, patients: data.patient, doctors: data.doctor });
        setClinic(data.clinic);
      } catch {}
    })();
  }, [invoiceId]);

  if (!invoice) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4 print:bg-white print:p-0">
      <div className="max-w-2xl mx-auto bg-card border rounded-lg p-6 print:border-0 print:shadow-none">
        <div className="flex justify-between items-start gap-4 border-b pb-4 mb-4">
          <div>
            {clinic?.logo_url && <img src={clinic.logo_url} alt={clinic?.name} className="h-12 mb-2" />}
            <h1 className="font-bold text-lg">{clinic?.name}</h1>
            <p className="text-xs text-muted-foreground whitespace-pre-line">{clinic?.address}</p>
            <p className="text-xs text-muted-foreground">{clinic?.phone}</p>
            {clinic?.gst_number && <p className="text-xs">GSTIN: {clinic.gst_number}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-muted-foreground">Invoice</p>
            <p className="font-mono font-bold">{invoice.invoice_number}</p>
            <p className="text-xs">{new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</p>
            <div className="mt-1"><StatusBadge status={invoice.status} /></div>
          </div>
        </div>
        <div className="text-sm mb-4">
          <p className="text-xs uppercase text-muted-foreground">Bill To</p>
          <p className="font-semibold">{invoice.patients?.name}</p>
          <p className="text-xs">{invoice.patients?.healthcare_id} · {invoice.patients?.phone}</p>
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
        <div className="flex justify-end gap-2 mt-6 print:hidden">
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print</Button>
          <Button disabled title="Online payments coming soon">Pay Now</Button>
        </div>
      </div>
    </div>
  );
}