import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer, Download } from "lucide-react";
import { toast } from "sonner";

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

        const { data: publicUrlData } = supabase.storage
          .from("prescriptions")
          .getPublicUrl(prescription.pdf_url);

        if (!publicUrlData?.publicUrl) {
          setError("Could not load prescription.");
          return;
        }

        const res = await fetch(publicUrlData.publicUrl);
        if (!res.ok) {
          setError("Could not load prescription. Please try again.");
          return;
        }
        setHtmlContent(await res.text());
      } catch {
        setError("Failed to load prescription.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [prescriptionId]);

  // Strip any inline print buttons embedded in the prescription HTML so we
  // never end up with two competing print buttons.
  const cleanHtml = htmlContent
    .replace(/<button[^>]*onclick=["']window\.print\(\)["'][\s\S]*?<\/button>/gi, "")
    .replace(/<div class=["']no-print["'][\s\S]*?<\/div>/gi, "");

  const handlePrint = () => {
    if (!htmlContent) {
      toast.error("Prescription not loaded yet");
      return;
    }
    const printHtml = `<!doctype html><html><head><meta charset="utf-8"/><title>Prescription</title><style>@page{size:A4;margin:16mm 14mm;}body{margin:0;padding:0;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@media print{.no-print{display:none !important;}}</style></head><body>${cleanHtml}</body></html>`;
    const blob = new Blob([printHtml], { type: "text/html;charset=utf-8" });
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

  const handleDownload = () => {
    if (!htmlContent) {
      toast.error("Prescription not loaded yet");
      return;
    }
    const blob = new Blob([cleanHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription-${prescriptionId}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

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
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-white/30 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button
            onClick={handlePrint}
            className="bg-white text-teal-700 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-teal-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
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
