import { supabase } from "@/integrations/supabase/client";

// Always use the /rx/ viewer URL — never raw storage URL
export const getPrescriptionViewerUrl = (prescriptionId: string) =>
  `${window.location.origin}/rx/${prescriptionId}`;

// Open prescription in new tab via viewer
export const openPrescription = (prescriptionId: string) => {
  window.open(getPrescriptionViewerUrl(prescriptionId), "_blank");
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

    const { data: signedData } = await supabase.storage
      .from("prescriptions")
      .createSignedUrl(data.pdf_url, 3600);

    if (!signedData?.signedUrl) {
      window.open(getPrescriptionViewerUrl(prescriptionId), "_blank");
      return;
    }

    const res = await fetch(signedData.signedUrl);
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

// WhatsApp share — uses /rx/ viewer link
export const shareViaWhatsApp = (
  prescriptionId: string,
  patientName: string,
  phone?: string | null,
  clinicName?: string,
) => {
  const url = getPrescriptionViewerUrl(prescriptionId);
  const intro = clinicName
    ? `Dear ${patientName}, your prescription from ${clinicName} is ready.`
    : `Dear ${patientName}, your prescription is ready.`;
  const msg = encodeURIComponent(`${intro}\n\nView here: ${url}`);
  const phoneClean = phone?.replace(/\D/g, "") || "";
  window.open(`https://wa.me/${phoneClean}?text=${msg}`, "_blank");
};
