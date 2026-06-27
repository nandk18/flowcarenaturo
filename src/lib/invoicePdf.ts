import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  patientName: string;
  patientPhone: string;
  doctorName: string | null;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicEmail: string;
  clinicWebsite: string;
  clinicLogoBase64: string | null;
  headerNote: string;
  footerNote: string;
  lineItems: Array<{
    name: string;
    unit: string;
    quantity: number;
    unit_price: number;
    gst_percentage: number;
    total: number;
  }>;
  subtotal: number;
  gstPercentage: number;
  gstAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
}

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function buildInvoiceDataFromRecord(invoice: any, clinic: any): Promise<InvoiceData> {
  // Resolve logo to base64
  let clinicLogoBase64: string | null = null;
  const logoRaw = clinic?.logo_url;
  const showLogo = clinic?.show_logo_on_invoice !== false;
  if (logoRaw && showLogo) {
    let logoUrl = logoRaw as string;
    if (!/^https?:\/\//i.test(logoUrl)) {
      const { data } = supabase.storage.from("clinic-assets").getPublicUrl(logoUrl);
      logoUrl = data.publicUrl;
    }
    clinicLogoBase64 = await urlToBase64(logoUrl);
  }

  const patient = invoice.patients || invoice.patient || {};
  const patientName =
    patient.name ||
    [patient.first_name, patient.last_name].filter(Boolean).join(" ") ||
    "";

  const doctorName = invoice.doctors?.name || invoice.doctor?.name || null;

  const lineItems = Array.isArray(invoice.line_items)
    ? invoice.line_items.map((it: any) => {
        const qty = Number(it.quantity ?? 1);
        const price = Number(it.unit_price ?? 0);
        return {
          name: it.name || it.description || "",
          unit: it.unit || "Nos",
          quantity: qty,
          unit_price: price,
          gst_percentage: Number(it.gst_percentage ?? 0),
          total: Number(it.total ?? qty * price),
        };
      })
    : [];

  return {
    invoiceNumber: invoice.invoice_number || "",
    invoiceDate: new Date(invoice.invoice_date).toLocaleDateString("en-IN"),
    patientName,
    patientPhone: patient.phone || "",
    doctorName,
    clinicName: clinic?.name || "Clinic",
    clinicAddress: clinic?.address || "",
    clinicPhone: clinic?.phone || "",
    clinicEmail: clinic?.email || "",
    clinicWebsite: clinic?.website || "",
    clinicLogoBase64,
    headerNote: clinic?.invoice_header_note || "",
    footerNote: clinic?.invoice_footer_note || "",
    lineItems,
    subtotal: Number(invoice.subtotal) || 0,
    gstPercentage: Number(invoice.gst_percentage) || 0,
    gstAmount: Number(invoice.gst_amount) || 0,
    discountAmount: Number(invoice.discount_amount) || 0,
    totalAmount: Number(invoice.total_amount) || 0,
    paidAmount: Number(invoice.paid_amount) || 0,
    outstandingAmount: Number(invoice.outstanding_amount) || 0,
    status: invoice.status || "unpaid",
  };
}

function createPdfDoc(data: InvoiceData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ── HEADER ──
  if (data.clinicLogoBase64) {
    try {
      doc.addImage(data.clinicLogoBase64, "PNG", margin, 10, 28, 28);
    } catch {}
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 80);
    doc.text(data.clinicName, margin + 32, 22);
  } else {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 80);
    doc.text(data.clinicName, margin, 22);
  }

  // Optional header note under clinic name
  if (data.headerNote) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80, 80, 80);
    const baseX = data.clinicLogoBase64 ? margin + 32 : margin;
    const noteLines = doc.splitTextToSize(data.headerNote, 95);
    let ny = 28;
    noteLines.slice(0, 3).forEach((line: string) => {
      doc.text(line, baseX, ny);
      ny += 4;
    });
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const rightX = W - margin;
  let contactY = 12;
  if (data.clinicAddress) {
    const lines = doc.splitTextToSize(data.clinicAddress, 70);
    lines.forEach((line: string) => {
      doc.text(line, rightX, contactY, { align: "right" });
      contactY += 4.5;
    });
  }
  if (data.clinicPhone) { doc.text(`Tel.: ${data.clinicPhone}`, rightX, contactY, { align: "right" }); contactY += 4.5; }
  if (data.clinicEmail) { doc.text(`Mail: ${data.clinicEmail}`, rightX, contactY, { align: "right" }); contactY += 4.5; }
  if (data.clinicWebsite) { doc.text(`Web: ${data.clinicWebsite}`, rightX, contactY, { align: "right" }); contactY += 4.5; }

  // Header separator
  doc.setDrawColor(20, 20, 80);
  doc.setLineWidth(0.8);
  doc.line(margin, 44, W - margin, 44);

  // Date/time
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  doc.text(`${dateStr}  ${timeStr}`, W - margin, 51, { align: "right" });

  // ── INVOICE INFO ──
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`No  :  ${data.invoiceNumber}`, margin, 58);
  doc.text(`Name  :  ${data.patientName}`, margin, 66);
  if (data.doctorName) {
    doc.text(`Doctor  :  ${data.doctorName}`, margin, 74);
  }

  // ── TABLE ──
  const tableStartY = data.doctorName ? 86 : 78;
  const col = {
    particulars: margin,
    unit: margin + 90,
    rate: margin + 110,
    qty: margin + 135,
    amount: margin + 155,
    amountEnd: W - margin,
  };

  // Header bg + border
  doc.setFillColor(240, 240, 245);
  doc.rect(margin, tableStartY - 5, W - 2 * margin, 8, "F");
  doc.setDrawColor(180, 180, 200);
  doc.setLineWidth(0.3);
  doc.rect(margin, tableStartY - 5, W - 2 * margin, 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 80);
  doc.text("Particulars", col.particulars + 2, tableStartY);
  doc.text("Unit", col.unit, tableStartY);
  doc.text("Rate", col.rate, tableStartY);
  doc.text("Qty", col.qty, tableStartY);
  doc.text("Amount", col.amountEnd - 2, tableStartY, { align: "right" });

  [col.unit, col.rate, col.qty, col.amount].forEach((x) => {
    doc.line(x - 2, tableStartY - 5, x - 2, tableStartY + 3);
  });

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.setFontSize(9);

  let rowY = tableStartY + 10;
  const rowHeight = 8;

  const items =
    data.lineItems.length > 0
      ? data.lineItems
      : [
          {
            name: "Consultation",
            unit: "Nos",
            quantity: 1,
            unit_price: data.subtotal,
            gst_percentage: 0,
            total: data.totalAmount,
          },
        ];

  items.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(252, 252, 255);
      doc.rect(margin, rowY - 5, W - 2 * margin, rowHeight, "F");
    }
    const nameLines = doc.splitTextToSize(String(item.name || ""), 85);
    doc.setTextColor(0);
    doc.text(nameLines[0], col.particulars + 2, rowY);
    doc.text(String(item.unit || "Nos"), col.unit, rowY);
    doc.text(Number(item.unit_price || 0).toFixed(2), col.rate + 18, rowY, { align: "right" });
    doc.text(String(item.quantity || 1), col.qty + 8, rowY, { align: "center" });
    doc.text(Number(item.total || 0).toFixed(2), col.amountEnd - 2, rowY, { align: "right" });

    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.2);
    doc.line(margin, rowY + 3, W - margin, rowY + 3);
    rowY += rowHeight;
  });

  // ── TOTALS ──
  rowY += 4;
  const totalsLabelX = col.qty + 6;
  const totalsValueX = col.amountEnd - 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  if (data.gstAmount > 0 || data.discountAmount > 0) {
    doc.text("Sub-Total", totalsLabelX, rowY, { align: "right" });
    doc.text(data.subtotal.toFixed(2), totalsValueX, rowY, { align: "right" });
    rowY += 7;
  }
  if (data.gstAmount > 0) {
    doc.text(`GST (${data.gstPercentage}%)`, totalsLabelX, rowY, { align: "right" });
    doc.text(data.gstAmount.toFixed(2), totalsValueX, rowY, { align: "right" });
    rowY += 7;
  }
  if (data.discountAmount > 0) {
    doc.text("Discount", totalsLabelX, rowY, { align: "right" });
    doc.text(`-${data.discountAmount.toFixed(2)}`, totalsValueX, rowY, { align: "right" });
    rowY += 7;
  }

  // Total Amount with double rules
  doc.setDrawColor(20, 20, 80);
  doc.setLineWidth(0.5);
  doc.line(totalsLabelX - 30, rowY - 3, W - margin, rowY - 3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 80);
  doc.text("Total Amount", totalsLabelX, rowY, { align: "right" });
  doc.text(data.totalAmount.toFixed(2), totalsValueX, rowY, { align: "right" });

  doc.setLineWidth(0.5);
  doc.line(totalsLabelX - 30, rowY + 3, W - margin, rowY + 3);
  rowY += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  if (data.paidAmount > 0) {
    doc.text("Paid", totalsLabelX, rowY, { align: "right" });
    doc.text(data.paidAmount.toFixed(2), totalsValueX, rowY, { align: "right" });
    rowY += 7;
  }
  if (data.outstandingAmount > 0) {
    doc.setTextColor(220, 50, 50);
    doc.text("Outstanding", totalsLabelX, rowY, { align: "right" });
    doc.text(data.outstandingAmount.toFixed(2), totalsValueX, rowY, { align: "right" });
    doc.setTextColor(0);
    rowY += 7;
  }

  // ── STATUS BADGE ──
  rowY += 4;
  const statusColors: Record<string, [number, number, number]> = {
    paid: [34, 197, 94],
    partial: [245, 158, 11],
    unpaid: [239, 68, 68],
    cancelled: [150, 150, 150],
  };
  const sc = statusColors[data.status] || [150, 150, 150];
  doc.setFillColor(sc[0], sc[1], sc[2]);
  doc.roundedRect(margin, rowY - 5, 30, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(String(data.status).toUpperCase(), margin + 15, rowY, { align: "center" });
  doc.setTextColor(0);

  // ── FOOTER ──
  doc.setDrawColor(20, 20, 80);
  doc.setLineWidth(0.5);
  doc.line(margin, H - 25, W - margin, H - 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`For ${data.clinicName}`, W / 2, H - 18, { align: "center" });

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Powered by FlowCare", W / 2, H - 12, { align: "center" });

  return doc;
}

async function buildInvoicePdf(invoice: any, clinic: any): Promise<jsPDF> {
  const data = await buildInvoiceDataFromRecord(invoice, clinic);
  return createPdfDoc(data);
}

export async function downloadInvoicePdf(invoice: any, clinic: any) {
  const doc = await buildInvoicePdf(invoice, clinic);
  doc.save(`${invoice.invoice_number || "invoice"}.pdf`);
}

export async function uploadInvoicePdf(invoice: any, clinic: any): Promise<string> {
  const doc = await buildInvoicePdf(invoice, clinic);
  const blob = doc.output("blob");
  const path = `${invoice.clinic_id}/${invoice.id}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("invoice-pdfs")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (upErr) throw upErr;

  const { data: signed, error: signErr } = await supabase.storage
    .from("invoice-pdfs")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr || !signed) throw signErr || new Error("Failed to sign URL");

  await supabase
    .from("invoices")
    .update({ pdf_url: path, pdf_generated_at: new Date().toISOString() } as any)
    .eq("id", invoice.id);

  return signed.signedUrl;
}

export async function getInvoicePdfUrl(invoice: any, clinic: any): Promise<string> {
  const generatedAt = invoice.pdf_generated_at ? new Date(invoice.pdf_generated_at).getTime() : 0;
  const updatedAt = invoice.updated_at ? new Date(invoice.updated_at).getTime() : Date.now();
  const needsNewPdf = !invoice.pdf_url || updatedAt > generatedAt;

  if (needsNewPdf) {
    return uploadInvoicePdf(invoice, clinic);
  }

  const { data: signed, error } = await supabase.storage
    .from("invoice-pdfs")
    .createSignedUrl(invoice.pdf_url, 60 * 60 * 24 * 365);
  if (error || !signed) {
    return uploadInvoicePdf(invoice, clinic);
  }
  return signed.signedUrl;
}
