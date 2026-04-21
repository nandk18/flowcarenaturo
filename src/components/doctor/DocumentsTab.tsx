import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Eye, Loader2, File } from "lucide-react";

type Props = {
  visitId: string;
  patientId: string;
  clinicId: string;
};

type Document = {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string | null;
};

export default function DocumentsTab({ visitId, patientId, clinicId }: Props) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from("patient_documents")
      .select("id, file_name, file_url, file_size, file_type, created_at")
      .eq("visit_id", visitId)
      .order("created_at", { ascending: false });
    setDocuments((data as Document[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocuments(); }, [visitId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large. Maximum 20MB.");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF, JPG, and PNG files are allowed.");
      return;
    }

    setUploading(true);
    try {
      const path = `${clinicId}/${patientId}/${visitId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("patient-documents")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("patient_documents").insert({
        visit_id: visitId,
        patient_id: patientId,
        clinic_id: clinicId,
        uploaded_by: user?.id,
        file_name: file.name,
        file_url: path,
        file_size: file.size,
        file_type: file.type,
      } as any);
      if (dbError) throw dbError;

      toast.success("Document uploaded");
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleView = async (fileUrl: string) => {
    const { data } = await supabase.storage
      .from("patient-documents")
      .createSignedUrl(fileUrl, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete ${doc.file_name}?`)) return;
    try {
      await supabase.storage.from("patient-documents").remove([doc.file_url]);
      await supabase.from("patient_documents").delete().eq("id", doc.id);
      toast.success("Document deleted");
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <Card className="rounded-2xl border-0 shadow-sm bg-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Documents</h3>
          <Label htmlFor="doc-upload" className="cursor-pointer">
            <Button variant="outline" size="sm" className="rounded-lg" asChild disabled={uploading}>
              <span>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload
              </span>
            </Button>
            <Input
              id="doc-upload"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </Label>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8">
            <File className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No documents uploaded for this visit</p>
            <p className="text-xs text-muted-foreground mt-1">Upload PDF, JPG, or PNG files up to 20MB</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(doc.file_size)}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleView(doc.file_url)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(doc)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
