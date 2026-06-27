import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

function buildInvoicePdf(invoice: any, clinic: any): jsPDF {

export function downloadInvoicePdf(invoice: any, clinic: any) {
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
  doc.text(invoice.patients?.name || "", 14, 50);
  if (invoice.patients?.healthcare_id) doc.text(invoice.patients.healthcare_id, 14, 55);
  if (invoice.patients?.phone) doc.text(invoice.patients.phone, 14, 60);
  if (invoice.doctors?.name) {
    doc.setFont("helvetica", "bold");
    doc.text("DOCTOR", w - 14, 44, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(invoice.doctors.name, w - 14, 50, { align: "right" });
  }

  // Line items
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

  let y = (doc as any).lastAutoTable.finalY + 6;
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

  doc.save(`${invoice.invoice_number || "invoice"}.pdf`);
}
