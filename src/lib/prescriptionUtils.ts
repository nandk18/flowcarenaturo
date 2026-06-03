import { openWhatsApp } from "@/lib/whatsapp";
import { supabase } from "@/integrations/supabase/client";

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

// Print prescription via hidden iframe using a blob URL.
// Uses the public storage URL so it works for anon users too.
export const printPrescription = async (prescriptionId: string) => {
  try {
    const { data } = await supabase
      .from("prescriptions")
      .select("pdf_url")
      .eq("id", prescriptionId)
      .single();

    if (!data?.pdf_url) {
      window.open(getPrescriptionViewerUrl(prescriptionId), "_blank");
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("prescriptions")
      .getPublicUrl(data.pdf_url);

    if (!publicUrlData?.publicUrl) return;

    const res = await fetch(publicUrlData.publicUrl);
    const html = await res.text();

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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
  } catch {
    window.open(getPrescriptionViewerUrl(prescriptionId), "_blank");
  }
};

// Download prescription as HTML file. Uses public storage URL.
export const downloadPrescription = async (
  prescriptionId: string,
  patientName: string,
) => {
  try {
    const { data } = await supabase
      .from("prescriptions")
      .select("pdf_url")
      .eq("id", prescriptionId)
      .single();

    if (!data?.pdf_url) return;

    const { data: publicUrlData } = supabase.storage
      .from("prescriptions")
      .getPublicUrl(data.pdf_url);

    if (!publicUrlData?.publicUrl) return;

    const res = await fetch(publicUrlData.publicUrl);
    const html = await res.text();

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription-${patientName.replace(/\s+/g, "-")}-${new Date()
      .toLocaleDateString("en-IN")
      .replace(/\//g, "-")}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch {
    window.open(getPrescriptionViewerUrl(prescriptionId), "_blank");
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
