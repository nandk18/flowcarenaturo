import { openWhatsApp } from "@/lib/whatsapp";

// Always use the /rx/ viewer URL — never raw storage URL
export const getPrescriptionViewerUrl = (prescriptionId: string) =>
  `${window.location.origin}/rx/${prescriptionId}`;

// Open prescription in new tab via viewer
export const openPrescription = (prescriptionId: string) => {
  const url = getPrescriptionViewerUrl(prescriptionId);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w || w.closed || typeof w.closed === "undefined") {
    window.location.href = url;
  }
};

// Copy prescription link to clipboard
export const copyPrescriptionLink = async (prescriptionId: string) => {
  const url = getPrescriptionViewerUrl(prescriptionId);
  await navigator.clipboard.writeText(url);
  return url;
};

// Print prescription via hidden iframe using a blob URL
// (load event fires reliably for iframe.src=blobUrl, unlike document.write)
export const printPrescription = async (prescriptionId: string) => {
  // Open the viewer page in a new tab — it has its own working print button
  // and doesn't require the caller to be authenticated against storage.
  const url = getPrescriptionViewerUrl(prescriptionId);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w || w.closed || typeof w.closed === "undefined") {
    window.location.href = url;
  }
};

// WhatsApp share — uses /rx/ viewer link
export const shareViaWhatsApp = (
  prescriptionId: string,
  patientName: string,
  phone?: string | null,
  clinicName?: string,
) => {
  const url = getPrescriptionViewerUrl(prescriptionId);
  const portalUrl = `${window.location.origin}/patient-portal`;
  const intro = clinicName
    ? `Dear ${patientName}, your prescription from ${clinicName} is ready.`
    : `Dear ${patientName}, your prescription is ready.`;
  openWhatsApp(
    phone || "",
    `${intro}\n\nView prescription: ${url}\n\nView all your health records: ${portalUrl}`,
  );
};
