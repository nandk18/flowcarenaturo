import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer } from "lucide-react";
import { printPrescription } from "@/lib/prescriptionUtils";

export default function PrescriptionViewer() {
  const { prescriptionId } = useParams<{ prescriptionId: string }>();
  const [htmlContent, setHtmlContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        if (!prescriptionId) {
          setError("Invalid prescription link.");
          return;
        }

        const { data: prescription, error: pErr } = await supabase
          .from("prescriptions")
          .select("pdf_url")
          .eq("id", prescriptionId)
          .single();

        if (pErr || !prescription?.pdf_url) {
          setError("Prescription not found or link has expired.");
          return;
        }

        const { data: signedData, error: signErr } = await supabase.storage
          .from("prescriptions")
          .createSignedUrl(prescription.pdf_url, 604800);

        if (signErr || !signedData?.signedUrl) {
          setError("Could not load prescription. The link may have expired.");
          return;
        }

        const res = await fetch(signedData.signedUrl);
        const html = await res.text();
        setHtmlContent(html);
      } catch {
        setError("Failed to load prescription.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [prescriptionId]);

  const handlePrint = () => {
    if (prescriptionId) printPrescription(prescriptionId);
  };

  // Strip any inline print buttons embedded in the prescription HTML so we
  // never end up with two competing print buttons.
  const cleanHtml = htmlContent
    .replace(/<button[^>]*onclick=["']window\.print\(\)["'][\s\S]*?<\/button>/gi, "")
    .replace(/<div class=["']no-print["'][\s\S]*?<\/div>/gi, "");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto" />
          <p className="text-sm text-gray-500">Loading prescription...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-4xl">⚠️</p>
          <h1 className="text-lg font-semibold text-gray-800">Link Unavailable</h1>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-xs text-gray-400">Please contact your clinic for a new copy.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      {/* Top bar with the ONLY print button */}
      <div className="no-print bg-teal-700 text-white px-4 py-2.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>🩺</span>
          <span>StethoScribe Prescription</span>
        </div>
        <button
          onClick={handlePrint}
          className="bg-white text-teal-700 text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-teal-50 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF
        </button>
      </div>

      {/* Render the prescription HTML (with any embedded print buttons stripped) */}
      <div className="px-2 sm:px-4">
        <div
          style={{
            maxWidth: "794px", // A4 width @ 96dpi
            margin: "16px auto",
            background: "white",
            boxShadow: "0 1px 8px rgba(0,0,0,0.10)",
            overflowX: "hidden",
            wordBreak: "break-word",
          }}
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
