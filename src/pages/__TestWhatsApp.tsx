// Dev-only test harness for Playwright. Mounted only when `import.meta.env.DEV`
// is true (i.e. `vite dev`) — never shipped in production builds.
//
// Renders deterministic Share / Send buttons that invoke the real
// `openWhatsApp` + message builders, so end-to-end browser tests can verify
// the resulting wa.me URL and encoded text in actual desktop Chromium and
// iPhone Safari (WebKit) emulation.

import {
  openWhatsApp,
  buildInvoiceMessage,
  buildPaymentReceiptMessage,
} from "@/lib/whatsapp";

const FIXTURE = {
  phone: "+91 98765 43210",
  patientName: "Krish Sekar",
  invoiceNumber: "INV-2026-0001",
  invoiceId: "11111111-1111-1111-1111-111111111111",
  clinicName: "Acme Clinic",
  totalAmount: 300,
};

export default function TestWhatsApp() {
  const shareInvoice = () => {
    openWhatsApp(
      FIXTURE.phone,
      buildInvoiceMessage(
        FIXTURE.patientName,
        FIXTURE.invoiceNumber,
        FIXTURE.totalAmount,
        "paid",
        FIXTURE.invoiceId,
        FIXTURE.clinicName,
      ),
    );
  };

  const sendReceipt = () => {
    openWhatsApp(
      FIXTURE.phone,
      buildPaymentReceiptMessage(
        FIXTURE.patientName,
        FIXTURE.invoiceNumber,
        100,
        "upi",
        FIXTURE.totalAmount,
        200,
        FIXTURE.clinicName,
        FIXTURE.invoiceId,
      ),
    );
  };

  return (
    <div style={{ padding: 32, fontFamily: "system-ui" }}>
      <h1>WhatsApp share — Playwright harness</h1>
      <p data-testid="ua">{navigator.userAgent}</p>
      <button
        id="share-invoice"
        data-testid="share-invoice"
        onClick={shareInvoice}
        style={{ padding: "12px 20px", marginRight: 12 }}
      >
        Share Invoice
      </button>
      <button
        id="send-receipt"
        data-testid="send-receipt"
        onClick={sendReceipt}
        style={{ padding: "12px 20px" }}
      >
        Send Receipt
      </button>
    </div>
  );
}

export { FIXTURE };