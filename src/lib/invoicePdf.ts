import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

function buildInvoicePdf(invoice: any, clinic: any): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const page = doc.internal.pageSize;
  const w = page.getWidth();

  // Header
  doc.setFillColor(13, 148, 136);
  doc.rect(0, 0, w, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(clinic?.name || "Clinic", 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (clinic?.address) doc.text(String(clinic.address).split("\n"), 14, 18);
  if (clinic?.phone) doc.text(`Tel: ${clinic.phone}`, 14, 26);
  if (clinic?.gst_number) doc.text(`GSTIN: ${clinic.gst_number}`, 14, 30);

  doc.setFontSize(10);
  doc.text("INVOICE", w - 14, 10, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(String(invoice.invoice_number || ""), w - 14, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(new Date(invoice.invoice_date).toLocaleDateString("en-IN"), w - 14, 22, { align: "right" });
  doc.text(String(invoice.status || "").toUpperCase(), w - 14, 28, { align: "right" });

  // Bill to
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", 14, 44);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.patients?.name || invoice.patient?.name || "", 14, 50);
  const pHc = invoice.patients?.healthcare_id || invoice.patient?.healthcare_id;
  const pPh = invoice.patients?.phone || invoice.patient?.phone;
  if (pHc) doc.text(pHc, 14, 55);
  if (pPh) doc.text(pPh, 14, 60);
  const dName = invoice.doctors?.name || invoice.doctor?.name;
  if (dName) {
    doc.setFont("helvetica", "bold");
    doc.text("DOCTOR", w - 14, 44, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(dName, w - 14, 50, { align: "right" });
  }

  const rows = (invoice.line_items as any[] || []).map((li, i) => [
    String(i + 1),
    li.description || li.name || "",
    String(li.quantity ?? 1),
    `₹${Number(li.unit_price ?? 0).toLocaleString("en-IN")}`,
    `₹${(Number(li.quantity ?? 1) * Number(li.unit_price ?? 0)).toLocaleString("en-IN")}`,
  ]);
  autoTable(doc, {
    startY: 68,
    head: [["#", "Description", "Qty", "Rate", "Amount"]],
    body: rows,
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 10 }, 2: { halign: "center", cellWidth: 14 }, 3: { halign: "right", cellWidth: 26 }, 4: { halign: "right", cellWidth: 28 } },
  });

  const y = (doc as any).lastAutoTable.finalY + 6;
  const totals: [string, string][] = [
    ["Subtotal", `₹${Number(invoice.subtotal).toLocaleString("en-IN")}`],
  ];
  if (Number(invoice.discount_amount) > 0) totals.push(["Discount", `−₹${Number(invoice.discount_amount).toLocaleString("en-IN")}`]);
  if (Number(invoice.gst_amount) > 0) totals.push([`GST (${invoice.gst_percentage}%)`, `₹${Number(invoice.gst_amount).toLocaleString("en-IN")}`]);
  totals.push(["Total", `₹${Number(invoice.total_amount).toLocaleString("en-IN")}`]);
  if (Number(invoice.paid_amount) > 0) totals.push(["Paid", `₹${Number(invoice.paid_amount).toLocaleString("en-IN")}`]);
  if (Number(invoice.outstanding_amount) > 0) totals.push(["Outstanding", `₹${Number(invoice.outstanding_amount).toLocaleString("en-IN")}`]);

  doc.setFontSize(10);
  totals.forEach(([k, v], i) => {
    const isTotal = k === "Total";
    doc.setFont("helvetica", isTotal ? "bold" : "normal");
    doc.text(k, w - 70, y + i * 6);
    doc.text(v, w - 14, y + i * 6, { align: "right" });
  });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated ${new Date().toLocaleDateString("en-IN")}`, w / 2, page.getHeight() - 8, { align: "center" });

  return doc;
}

export function downloadInvoicePdf(invoice: any, clinic: any) {
  const doc = buildInvoicePdf(invoice, clinic);
  doc.save(`${invoice.invoice_number || "invoice"}.pdf`);
}

/**
 * Generate the invoice PDF using ONLY the saved invoice record, upload it to
 * the `invoice-pdfs` bucket under `<clinic_id>/<invoice_id>.pdf`, save the
 * storage path + pdf_generated_at, and return a signed URL.
 */
export async function uploadInvoicePdf(invoice: any, clinic: any): Promise<string> {
  const doc = buildInvoicePdf(invoice, clinic);
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

/**
 * Returns a signed URL for the invoice PDF. Regenerates the PDF whenever the
 * invoice has been edited since the cached PDF was generated (or no cache exists).
 * Always uses the saved invoice record as the single source of truth.
 */
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
    // fallback to regenerate
    return uploadInvoicePdf(invoice, clinic);
  }
  return signed.signedUrl;
}
