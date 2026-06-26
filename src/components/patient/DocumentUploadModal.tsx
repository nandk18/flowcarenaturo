import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  MAX_DOC_SIZE_MB,
  ACCEPTED_MIME,
  ACCEPTED_EXT,
  formatFileSize,
} from "@/lib/documentCategories";

type QueuedFile = { file: File; category: DocumentCategory };

type Props = {
  open: boolean;
  onClose: () => void;
  onUpload: (files: QueuedFile[]) => Promise<void>;
};

export default function DocumentUploadModal({ open, onClose, onUpload }: Props) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<DocumentCategory>("Medical Report");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid: QueuedFile[] = [];
    for (const f of arr) {
      if (f.size > MAX_DOC_SIZE_MB * 1024 * 1024) {
        toast.error(`${f.name} exceeds ${MAX_DOC_SIZE_MB}MB`);
        continue;
      }
      if (!ACCEPTED_MIME.includes(f.type) && !/\.(pdf|jpg|jpeg|png|doc|docx)$/i.test(f.name)) {
        toast.error(`${f.name}: unsupported file type`);
        continue;
      }
      valid.push({ file: f, category: defaultCategory });
    }
    setQueue((q) => [...q, ...valid]);
  };

  const handleSubmit = async () => {
    if (queue.length === 0) {
      toast.error("Add at least one file");
      return;
    }
    setUploading(true);
    try {
      await onUpload(queue);
      setQueue([]);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setQueue([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !uploading && reset()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Default Category</Label>
            <Select value={defaultCategory} onValueChange={(v) => setDefaultCategory(v as DocumentCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-muted-foreground/50"
            }`}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, JPG, PNG, DOC, DOCX · max {MAX_DOC_SIZE_MB}MB per file
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXT}
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {queue.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {queue.map((q, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{q.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(q.file.size)}</p>
                  </div>
                  <Select
                    value={q.category}
                    onValueChange={(v) => setQueue((s) => s.map((x, idx) => idx === i ? { ...x, category: v as DocumentCategory } : x))}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => setQueue((s) => s.filter((_, idx) => idx !== i))}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Badge variant="outline" className="text-xs">{queue.length} file{queue.length !== 1 ? "s" : ""} ready</Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={reset} disabled={uploading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={uploading || queue.length === 0}>
            {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
