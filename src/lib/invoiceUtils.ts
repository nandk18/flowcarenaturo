export const buildInvoiceHtml = (invoice: any, clinic: any) => {
  const items = (invoice.line_items as any[]) || [];
  const lineItemsHtml = items
    .map((item: any) => {
      const qty = Number(item.quantity || 0);
      const rate = Number(item.unit_price || 0);
      const amount = qty * rate;
      const name = item.name || item.description || "";
      const unit = item.unit || "Nos";
      return `
      <tr>
        <td style="padding:8px 10px;border:1px solid #000;font-size:12px;color:#000;">${escapeHtml(name)}</td>
        <td style="padding:8px 10px;border:1px solid #000;font-size:12px;text-align:center;color:#000;">${escapeHtml(String(unit))}</td>
        <td style="padding:8px 10px;border:1px solid #000;font-size:12px;text-align:right;color:#000;">${rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding:8px 10px;border:1px solid #000;font-size:12px;text-align:center;color:#000;">${qty}</td>
        <td style="padding:8px 10px;border:1px solid #000;font-size:12px;text-align:right;color:#000;font-weight:600;">${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>`;
    })
    .join("");

  // Pad to a minimum of 6 rows so the table looks consistent
  const minRows = 6;
  const padRows = Math.max(0, minRows - items.length);
  const padHtml = Array.from({ length: padRows })
    .map(
      () => `
      <tr>
        <td style="padding:8px 10px;border:1px solid #000;font-size:12px;height:24px;">&nbsp;</td>
        <td style="padding:8px 10px;border:1px solid #000;"></td>
        <td style="padding:8px 10px;border:1px solid #000;"></td>
        <td style="padding:8px 10px;border:1px solid #000;"></td>
        <td style="padding:8px 10px;border:1px solid #000;"></td>
      </tr>`
    )
    .join("");

  const statusColor =
    invoice.status === "paid"
      ? "#10B981"
      : invoice.status === "partial"
      ? "#F59E0B"
      : invoice.status === "cancelled"
      ? "#6B7280"
      : "#EF4444";

  const showLogo = clinic?.show_logo_on_invoice !== false;
  const logoImg = clinic?.logo_url && showLogo
    ? `<img src="${clinic.logo_url}" alt="${escapeHtml(clinic?.name || "")}" style="height:56px;max-width:140px;object-fit:contain;display:block;margin-bottom:6px;" />`
    : "";

  const headerNote = clinic?.invoice_header_note
    ? `<div style="font-size:11px;color:#555;font-style:italic;margin-top:4px;white-space:pre-line;">${escapeHtml(clinic.invoice_header_note)}</div>`
    : "";
  const footerNote = clinic?.invoice_footer_note
    ? `<div style="font-size:11px;color:#555;margin-top:10px;white-space:pre-line;">${escapeHtml(clinic.invoice_footer_note)}</div>`
    : "";

  const invDate = invoice.invoice_date ? new Date(invoice.invoice_date) : new Date();
  const dateStr = invDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const sub = Number(invoice.subtotal || 0);
  const disc = Number(invoice.discount_amount || 0);
  const gstAmt = Number(invoice.gst_amount || 0);
  const total = Number(invoice.total_amount || 0);
  const paid = Number(invoice.paid_amount || 0);
  const outstanding = Number(invoice.outstanding_amount || 0);

  const fmt = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `
  <div style="max-width:760px;margin:0 auto;background:#fff;color:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;">

    <!-- HEADER -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="vertical-align:top;width:55%;">
          ${logoImg}
          <div style="font-size:20px;font-weight:700;letter-spacing:0.3px;color:#000;">${escapeHtml(clinic?.name || "Clinic")}</div>
          <div style="font-size:11px;color:#444;margin-top:6px;letter-spacing:1.5px;font-weight:600;">TAX INVOICE</div>
        </td>
        <td style="vertical-align:top;text-align:right;font-size:11px;color:#222;line-height:1.6;">
          ${clinic?.address ? `<div style="white-space:pre-line;">${escapeHtml(clinic.address)}</div>` : ""}
          ${clinic?.phone ? `<div>Phone: ${escapeHtml(clinic.phone)}</div>` : ""}
          ${clinic?.email ? `<div>Email: ${escapeHtml(clinic.email)}</div>` : ""}
          ${clinic?.website ? `<div>${escapeHtml(clinic.website)}</div>` : ""}
          ${clinic?.gst_number ? `<div style="margin-top:4px;">GSTIN: ${escapeHtml(clinic.gst_number)}</div>` : ""}
          <div style="margin-top:8px;color:#555;">${dateStr} · ${timeStr}</div>
        </td>
      </tr>
    </table>

    <!-- BORDERED INFO BOX -->
    <table style="width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:14px;">
      <tr>
        <td style="padding:8px 10px;border-right:1px solid #000;font-size:11px;width:33%;vertical-align:top;">
          <div style="color:#555;text-transform:uppercase;letter-spacing:0.5px;font-size:10px;">Invoice No.</div>
          <div style="font-weight:700;font-family:monospace;margin-top:2px;font-size:13px;">${escapeHtml(invoice.invoice_number || "")}</div>
        </td>
        <td style="padding:8px 10px;border-right:1px solid #000;font-size:11px;width:40%;vertical-align:top;">
          <div style="color:#555;text-transform:uppercase;letter-spacing:0.5px;font-size:10px;">Patient Name</div>
          <div style="font-weight:700;margin-top:2px;font-size:13px;">${escapeHtml(invoice.patients?.name || "")}</div>
          ${invoice.patients?.healthcare_id ? `<div style="font-family:monospace;font-size:10px;color:#555;">${escapeHtml(invoice.patients.healthcare_id)}</div>` : ""}
          ${invoice.patients?.phone ? `<div style="font-size:10px;color:#555;">${escapeHtml(invoice.patients.phone)}</div>` : ""}
        </td>
        <td style="padding:8px 10px;font-size:11px;width:27%;vertical-align:top;">
          <div style="color:#555;text-transform:uppercase;letter-spacing:0.5px;font-size:10px;">Doctor</div>
          <div style="font-weight:600;margin-top:2px;font-size:12px;">${escapeHtml(invoice.doctors?.name || "—")}</div>
          <div style="display:inline-block;margin-top:6px;background:${statusColor};color:#fff;padding:2px 8px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:0.5px;">${String(invoice.status || "unpaid").toUpperCase()}</div>
        </td>
      </tr>
    </table>

    <!-- ITEMS TABLE -->
    <table style="width:100%;border-collapse:collapse;border:1px solid #000;">
      <thead>
        <tr style="background:#f4f4f4;">
          <th style="text-align:left;padding:8px 10px;border:1px solid #000;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#000;">Particulars</th>
          <th style="text-align:center;padding:8px 10px;border:1px solid #000;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#000;width:70px;">Unit</th>
          <th style="text-align:right;padding:8px 10px;border:1px solid #000;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#000;width:90px;">Rate</th>
          <th style="text-align:center;padding:8px 10px;border:1px solid #000;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#000;width:60px;">Qty</th>
          <th style="text-align:right;padding:8px 10px;border:1px solid #000;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#000;width:110px;">Amount</th>
        </tr>
      </thead>
      <tbody>${lineItemsHtml}${padHtml}</tbody>
    </table>

    <!-- TOTALS -->
    <table style="width:100%;border-collapse:collapse;margin-top:14px;">
      <tr>
        <td style="vertical-align:top;width:55%;font-size:11px;color:#444;">
          ${invoice.notes ? `<div style="border:1px solid #000;padding:8px 10px;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#555;">Notes</div><div style="margin-top:4px;font-size:12px;color:#000;">${escapeHtml(invoice.notes)}</div></div>` : ""}
        </td>
        <td style="vertical-align:top;width:45%;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;color:#000;">
            <tr>
              <td style="padding:4px 10px;text-align:right;">Sub-Total</td>
              <td style="padding:4px 10px;text-align:right;width:110px;">${fmt(sub)}</td>
            </tr>
            ${disc > 0 ? `<tr><td style="padding:4px 10px;text-align:right;color:#555;">Discount</td><td style="padding:4px 10px;text-align:right;color:#555;">− ${fmt(disc)}</td></tr>` : ""}
            ${gstAmt > 0 ? `<tr><td style="padding:4px 10px;text-align:right;">GST (${invoice.gst_percentage}%)</td><td style="padding:4px 10px;text-align:right;">${fmt(gstAmt)}</td></tr>` : ""}
            <tr>
              <td style="padding:8px 10px;text-align:right;font-weight:700;font-size:13px;border-top:3px double #000;border-bottom:3px double #000;">Total Amount</td>
              <td style="padding:8px 10px;text-align:right;font-weight:700;font-size:13px;border-top:3px double #000;border-bottom:3px double #000;">₹ ${fmt(total)}</td>
            </tr>
            ${paid > 0 ? `<tr><td style="padding:4px 10px;text-align:right;color:#10B981;">Paid</td><td style="padding:4px 10px;text-align:right;color:#10B981;">${fmt(paid)}</td></tr>` : ""}
            ${outstanding > 0 ? `<tr><td style="padding:4px 10px;text-align:right;color:#EF4444;font-weight:600;">Outstanding</td><td style="padding:4px 10px;text-align:right;color:#EF4444;font-weight:600;">${fmt(outstanding)}</td></tr>` : ""}
          </table>
        </td>
      </tr>
    </table>

    <!-- FOOTER -->
    <div style="text-align:center;margin-top:32px;padding-top:12px;border-top:1px solid #000;font-size:11px;color:#000;">
      <div style="font-weight:700;letter-spacing:0.5px;">${escapeHtml(clinic?.name || "")}</div>
      <div style="color:#555;margin-top:2px;">Thank you for visiting${clinic?.name ? ` ${escapeHtml(clinic.name)}` : ""}</div>
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
