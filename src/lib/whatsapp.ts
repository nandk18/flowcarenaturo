export const openWhatsApp = (phone: string | null | undefined, message: string) => {
  const phoneClean = phone?.replace(/\D/g, "") || "";
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${phoneClean}?text=${encoded}`;
  // On mobile: same-tab nav opens the WhatsApp app and back returns to us.
  // On desktop: open WhatsApp Web in a new tab so the app stays open.
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

export const buildInvoiceMessage = (
  patientName: string,
  invoiceNumber: string,
  totalAmount: number,
  status: string,
  invoiceId: string,
  clinicName: string
) => {
  const url = `${window.location.origin}/invoice/${invoiceId}`;
  const statusLabel =
    status === "paid" ? "PAID ✅" : status === "partial" ? "PARTIALLY PAID" : "PENDING";
  return (
    `Dear ${patientName},\n\n` +
    `Your invoice ${invoiceNumber} from ${clinicName} is ready.\n\n` +
    `Amount: ₹${Number(totalAmount).toLocaleString("en-IN")}\n` +
    `Status: ${statusLabel}\n\n` +
    `View invoice: ${url}`
  );
};

export const buildPaymentReceiptMessage = (
  patientName: string,
  invoiceNumber: string,
  paidAmount: number,
  paymentMethod: string,
  totalAmount: number,
  outstandingAmount: number,
  clinicName: string,
  invoiceId: string
) => {
  const url = `${window.location.origin}/invoice/${invoiceId}`;
  const methodLabel: Record<string, string> = {
    cash: "Cash",
    upi: "UPI",
    card: "Card",
    insurance: "Insurance",
    other: "Other",
  };
  let message =
    `Dear ${patientName},\n\n` +
    `✅ Payment received at ${clinicName}\n\n` +
    `Invoice: ${invoiceNumber}\n` +
    `Amount Paid: ₹${Number(paidAmount).toLocaleString("en-IN")} (${methodLabel[paymentMethod] || paymentMethod})\n` +
    `Total Bill: ₹${Number(totalAmount).toLocaleString("en-IN")}\n`;
  if (outstandingAmount > 0) {
    message += `Outstanding: ₹${Number(outstandingAmount).toLocaleString("en-IN")}\n`;
  } else {
    message += `Balance: Fully Paid ✅\n`;
  }
  message += `\nView receipt: ${url}\n\nThank you for choosing ${clinicName}.`;
  return message;
};