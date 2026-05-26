export const buildInvoiceHtml = (invoice: any, clinic: any) => {
  const lineItemsHtml =
    (invoice.line_items as any[])
      ?.map(
        (item: any, i: number) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:12px;color:#475569;">${i + 1}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:13px;color:#0f172a;">${escapeHtml(item.description || "")}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:center;color:#0f172a;">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:right;color:#0f172a;">₹${Number(item.unit_price).toLocaleString("en-IN")}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:right;color:#0f172a;font-weight:600;">₹${(Number(item.quantity) * Number(item.unit_price)).toLocaleString("en-IN")}</td>
      </tr>`
      )
      .join("") || "";

  const statusColor =
    invoice.status === "paid" ? "#10B981" : invoice.status === "partial" ? "#F59E0B" : invoice.status === "cancelled" ? "#6B7280" : "#EF4444";

  const logoImg = clinic?.logo_url
    ? `<img src="${clinic.logo_url}" alt="${escapeHtml(clinic?.name || "")}" style="height:48px;margin-bottom:8px;object-fit:contain;" />`
    : "";

  return `
  <div style="max-width:760px;margin:0 auto;background:#fff;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;padding:24px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;gap:16px;">
      <div style="flex:1;">
        ${logoImg}
        <div style="font-size:18px;font-weight:700;">${escapeHtml(clinic?.name || "Clinic")}</div>
        <div style="font-size:11px;opacity:0.9;white-space:pre-line;margin-top:4px;">${escapeHtml(clinic?.address || "")}</div>
        ${clinic?.phone ? `<div style="font-size:11px;opacity:0.9;">Tel: ${escapeHtml(clinic.phone)}</div>` : ""}
        ${clinic?.gst_number ? `<div style="font-size:11px;opacity:0.9;margin-top:4px;">GSTIN: ${escapeHtml(clinic.gst_number)}</div>` : ""}
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">Invoice</div>
        <div style="font-family:monospace;font-size:16px;font-weight:700;margin-top:2px;">${escapeHtml(invoice.invoice_number || "")}</div>
        <div style="font-size:11px;opacity:0.9;margin-top:6px;">${new Date(invoice.invoice_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
        <div style="display:inline-block;margin-top:8px;background:${statusColor};color:#fff;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.5px;">${String(invoice.status || "").toUpperCase()}</div>
      </div>
    </div>

    <div style="padding:20px 24px;display:flex;gap:24px;border-bottom:1px solid #eee;">
      <div style="flex:1;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Bill To</div>
        <div style="font-size:14px;font-weight:600;margin-top:4px;">${escapeHtml(invoice.patients?.name || "")}</div>
        <div style="font-size:11px;color:#0d9488;font-family:monospace;">${escapeHtml(invoice.patients?.healthcare_id || "")}</div>
        ${invoice.patients?.phone ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(invoice.patients.phone)}</div>` : ""}
      </div>
      ${
        invoice.doctors?.name
          ? `<div style="text-align:right;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Doctor</div><div style="font-size:13px;margin-top:4px;">${escapeHtml(invoice.doctors.name)}</div></div>`
          : ""
      }
    </div>

    <table style="width:100%;border-collapse:collapse;margin:16px 0 0 0;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="text-align:left;padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#475569;width:32px;">#</th>
          <th style="text-align:left;padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#475569;">Description</th>
          <th style="text-align:center;padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#475569;width:50px;">Qty</th>
          <th style="text-align:right;padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#475569;width:90px;">Rate</th>
          <th style="text-align:right;padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#475569;width:100px;">Amount</th>
        </tr>
      </thead>
      <tbody>${lineItemsHtml}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;padding:16px 24px;">
      <div style="width:280px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Subtotal</span><span>₹${Number(invoice.subtotal).toLocaleString("en-IN")}</span></div>
        ${Number(invoice.discount_amount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#64748b;"><span>Discount</span><span>−₹${Number(invoice.discount_amount).toLocaleString("en-IN")}</span></div>` : ""}
        ${Number(invoice.gst_amount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>GST (${invoice.gst_percentage}%)</span><span>₹${Number(invoice.gst_amount).toLocaleString("en-IN")}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #0f172a;margin-top:6px;font-weight:700;font-size:15px;"><span>Total</span><span style="color:#0d9488;">₹${Number(invoice.total_amount).toLocaleString("en-IN")}</span></div>
        ${Number(invoice.paid_amount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#10B981;"><span>Paid</span><span>₹${Number(invoice.paid_amount).toLocaleString("en-IN")}</span></div>` : ""}
        ${Number(invoice.outstanding_amount) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#EF4444;font-weight:600;"><span>Outstanding</span><span>₹${Number(invoice.outstanding_amount).toLocaleString("en-IN")}</span></div>` : ""}
      </div>
    </div>

    ${invoice.notes ? `<div style="padding:0 24px 16px;font-size:12px;color:#475569;border-top:1px solid #eee;padding-top:12px;margin:0 24px;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Notes</div><div style="margin-top:4px;">${escapeHtml(invoice.notes)}</div></div>` : ""}

    <div style="text-align:center;padding:16px;font-size:10px;color:#94a3b8;border-top:1px solid #eee;">
      Generated by StethoScribe · ${new Date().toLocaleDateString("en-IN")}
    </div>
  </div>`;
};

export const printInvoice = (invoiceHtml: string) => {
  const printHtml = `<!doctype html><html><head><meta charset="utf-8"/><title>Invoice</title><style>
    @page { size: A4; margin: 16mm 14mm; }
    body { margin:0; padding:0; background:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @media print { body { padding: 0; } .no-print { display: none !important; } }
  </style></head><body>${invoiceHtml}</body></html>`;

  const blob = new Blob([printHtml], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.src = blobUrl;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
      URL.revokeObjectURL(blobUrl);
    }, 2000);
  };
};

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}