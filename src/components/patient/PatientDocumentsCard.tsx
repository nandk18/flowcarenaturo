import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getProfileId } from "@/utils/getProfileId";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, FileType, Trash2, Upload, Loader2, ExternalLink, User } from "lucide-react";
import DocumentUploadModal from "./DocumentUploadModal";
import { DocumentCategory, formatFileSize, iconForType } from "@/lib/documentCategories";

type Doc = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  uploaded_by_patient: boolean | null;
  created_at: string | null;
};

type Props = {
  patientId: string;
  clinicId: string;
};

const BUCKET = "patient-documents";

export default function PatientDocumentsCard({ patientId, clinicId }: Props) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("patient_documents")
      .select("id, file_name, file_url, file_type, file_size, category, uploaded_by_patient, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    setDocs((data as Doc[]) || []);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (queued: { file: File; category: DocumentCategory }[]) => {
    const profileId = await getProfileId();
    for (const { file, category } of queued) {
      const path = `${clinicId}/${patientId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("patient_documents").insert({
        clinic_id: clinicId,
        patient_id: patientId,
        file_name: file.name,
        file_url: path,
        file_type: file.type,
        file_size: file.size,
        category,
        uploaded_by_patient: false,
        uploaded_by: profileId,
      } as any);
      if (dbErr) throw dbErr;
    }
    toast.success(`${queued.length} document${queued.length !== 1 ? "s" : ""} uploaded`);
    await load();
  };

  const openDoc = async (doc: Doc) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_url, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Could not open file");
  };

  const deleteDoc = async (doc: Doc) => {
    if (!confirm(`Delete ${doc.file_name}?`)) return;
    try {
      await supabase.storage.from(BUCKET).remove([doc.file_url]);
      await supabase.from("patient_documents").delete().eq("id", doc.id);
      toast.success("Document deleted");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const Icon = ({ type }: { type: string | null }) => {
    const kind = iconForType(type);
    if (kind === "image") return <ImageIcon className="h-5 w-5 text-blue-500" />;
    if (kind === "pdf") return <FileText className="h-5 w-5 text-red-500" />;
    if (kind === "doc") return <FileType className="h-5 w-5 text-indigo-500" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <Card className="shadow-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold">Documents</h3>
          <Button type="button" size="sm" variant="outline" onClick={() => setModalOpen(true)}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2.5">
                <Icon type={doc.file_type} />
                <div className="min-w-0 flex-1">
                  <button onClick={() => openDoc(doc)} className="text-sm font-medium text-foreground hover:text-primary text-left truncate w-full flex items-center gap-1">
                    {doc.file_name}
                    <ExternalLink className="h-3 w-3 inline opacity-60" />
                  </button>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {doc.category && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{doc.category}</Badge>}
                    {doc.uploaded_by_patient && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 bg-blue-50 text-blue-700">
                        <User className="h-2.5 w-2.5 mr-0.5" /> by patient
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                      {doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => deleteDoc(doc)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DocumentUploadModal open={modalOpen} onClose={() => setModalOpen(false)} onUpload={handleUpload} />
    </Card>
  );
}
