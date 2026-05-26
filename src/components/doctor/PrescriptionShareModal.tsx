import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, MessageCircle, Mail, Copy, Download, Printer, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import EMRExportButtons from "@/components/doctor/EMRExportButtons";
import { useAuditLog, AUDIT_ACTIONS } from "@/hooks/useAuditLog";
import { openWhatsApp } from "@/lib/whatsapp";

type Props = {
  open: boolean;
  onClose: () => void;
  prescriptionPdfUrl: string | null;
  prescriptionId: string | null;
  patient: { name: string; phone: string | null; email: string | null; healthcare_id: string | null } | null;
  clinicName: string;
  doctorName: string;
  emrExportProps?: {
    patient: any;
    visit: any;
    doctor: any;
    soap: any;
    medications: any[];
    investigations: string[];
    followUpDate?: string | null;
  };
};

export default function PrescriptionShareModal({ open, onClose, prescriptionPdfUrl, prescriptionId, patient, clinicName, doctorName, emrExportProps }: Props) {
  const viewerUrl = prescriptionId ? `${window.location.origin}/rx/${prescriptionId}` : null;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const { log: auditLog } = useAuditLog();

  useEffect(() => {
    if (open && prescriptionPdfUrl) {
      setLoading(true);
      supabase.storage.from("prescriptions").createSignedUrl(prescriptionPdfUrl, 604800)
        .then(({ data }) => { setSignedUrl(data?.signedUrl || null); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setSignedUrl(null);
    }
  }, [open, prescriptionPdfUrl]);

  const handleWhatsApp = () => {
    if (!patient?.phone || !viewerUrl) return;
    openWhatsApp(
      patient.phone,
      `Dear ${patient.name}, your prescription from ${clinicName} is ready.\n\nView & Download: ${viewerUrl}\n\nThe prescription will open in your browser.`
    );
    if (prescriptionId) {
      auditLog(AUDIT_ACTIONS.PRESCRIPTION_SHARED, "prescription", prescriptionId, patient?.name, { via: "whatsapp" });
      supabase.from("document_shares").insert({ prescription_id: prescriptionId, shared_via: "whatsapp", recipient: patient.phone }).then(() => {});
    }
  };

  const handleEmail = () => {
    if (!patient?.email || !viewerUrl) return;
    const subject = encodeURIComponent(`Your Prescription - ${clinicName}`);
    const body = encodeURIComponent(
      `Dear ${patient.name},\n\nYour prescription is ready.\nClick here to view: ${viewerUrl}\n\nRegards,\n${doctorName}\n${clinicName}`
    );
    window.open(`mailto:${patient.email}?subject=${subject}&body=${body}`);
    if (prescriptionId) {
      auditLog(AUDIT_ACTIONS.PRESCRIPTION_SHARED, "prescription", prescriptionId, patient?.name, { via: "email" });
      supabase.from("document_shares").insert({ prescription_id: prescriptionId, shared_via: "email", recipient: patient.email }).then(() => {});
    }
  };

  const handleCopy = async () => {
    if (!viewerUrl) return;
    try {
      await navigator.clipboard.writeText(viewerUrl);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const openHtmlAsBlobUrl = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  };

  const isHtml = prescriptionPdfUrl?.endsWith(".html");

  const handleDownload = async () => {
    if (!signedUrl) return;
    if (isHtml) {
      const blobUrl = await openHtmlAsBlobUrl(signedUrl);
      if (blobUrl) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `prescription-${patient?.name}-${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.html`;
        a.click();
      }
    } else {
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = `prescription-${patient?.name}-${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.pdf`;
      a.target = "_blank";
      a.click();
    }
  };

  const handlePrint = async () => {
    if (!prescriptionId) return;
    const { printPrescription } = await import("@/lib/prescriptionUtils");
    await printPrescription(prescriptionId);
  };

  const shareReady = !!viewerUrl;

  const content = (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Prescription Ready</p>
          <p className="text-sm text-muted-foreground">{patient?.name} · {patient?.healthcare_id || ""}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !shareReady ? (
        <p className="text-sm text-muted-foreground text-center py-4">Prescription URL not available yet. Try again in a moment.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-12 gap-2 rounded-xl" onClick={handleWhatsApp} disabled={!patient?.phone}>
              <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
            </Button>
            <Button variant="outline" className="h-12 gap-2 rounded-xl" onClick={handleEmail} disabled={!patient?.email}>
              <Mail className="h-4 w-4 text-blue-600" /> Email
            </Button>
            <Button variant="outline" className="h-12 gap-2 rounded-xl" onClick={handleCopy}>
              <Copy className="h-4 w-4" /> Copy Link
            </Button>
            <Button variant="outline" className="h-12 gap-2 rounded-xl" onClick={handleDownload} disabled={!signedUrl}>
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
          <Button variant="outline" className="w-full h-12 gap-2 rounded-xl" onClick={handlePrint} disabled={!signedUrl}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <p className="text-xs text-muted-foreground text-center">Share link works without login</p>
        </>
      )}

      {/* EMR Export */}
      {emrExportProps && (
        <div className="border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground mb-2">Export to EMR</p>
          <EMRExportButtons {...emrExportProps} />
        </div>
      )}

      <Button className="w-full rounded-xl" onClick={onClose}>Done</Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={v => !v && onClose()}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader><DrawerTitle>Share Prescription</DrawerTitle></DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Share Prescription</DialogTitle></DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
