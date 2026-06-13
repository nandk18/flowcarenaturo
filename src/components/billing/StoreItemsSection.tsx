import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Upload, FileDown } from "lucide-react";
import { useClinic } from "@/hooks/useClinic";
import * as XLSX from "xlsx";

type StoreItem = {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  category: string | null;
  sku: string | null;
  unit_price: number;
  gst_percentage: number | null;
  unit: string | null;
  is_active: boolean | null;
};

export default function StoreItemsSection() {
  const { clinic } = useClinic();
  const clinicId = clinic?.id;
  const [rows, setRows] = useState<StoreItem[]>([]);
  const [editing, setEditing] = useState<StoreItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("store_items")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as StoreItem[]);
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (row: StoreItem) => {
    const { error } = await supabase.from("store_items").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (row: StoreItem) => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    const { error } = await supabase.from("store_items").update({ is_active: false }).eq("id", row.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  if (!clinicId) return null;

  return (
    <Card className="rounded-2xl border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 font-display">
          <Package className="h-5 w-5 text-primary" /> Store Items
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import Items
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add New Item
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Manage your store inventory. Items here can be quickly added to invoices.
        </p>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No store items yet</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} className={r.is_active === false ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm">{r.category || "—"}</TableCell>
                  <TableCell className="text-sm font-mono">{r.sku || "—"}</TableCell>
                  <TableCell className="text-right">₹{Number(r.unit_price).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">{Number(r.gst_percentage || 0)}%</TableCell>
                  <TableCell className="text-sm">{r.unit || "—"}</TableCell>
                  <TableCell><Switch checked={!!r.is_active} onCheckedChange={() => toggleActive(r)} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setModalOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <StoreItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clinicId={clinicId}
        item={editing}
        onSaved={load}
      />
      <ImportItemsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        clinicId={clinicId}
        onImported={load}
      />
    </Card>
  );
}

function StoreItemModal({
  open, onClose, clinicId, item, onSaved,
}: {
  open: boolean; onClose: () => void; clinicId: string; item: StoreItem | null; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState(0);
  const [gstPct, setGstPct] = useState(0);
  const [unit, setUnit] = useState("unit");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setCategory(item?.category ?? "");
    setSku(item?.sku ?? "");
    setDescription(item?.description ?? "");
    setUnitPrice(Number(item?.unit_price ?? 0));
    setGstPct(Number(item?.gst_percentage ?? 0));
    setUnit(item?.unit ?? "unit");
    setIsActive(item ? !!item.is_active : true);
  }, [open, item]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (unitPrice <= 0) return toast.error("Unit price must be > 0");
    setSaving(true);
    const payload = {
      clinic_id: clinicId,
      name: name.trim(),
      category: category || null,
      sku: sku || null,
      description: description || null,
      unit_price: unitPrice,
      gst_percentage: gstPct,
      unit: unit || "unit",
      is_active: isActive,
    };
    const { error } = item
      ? await supabase.from("store_items").update(payload).eq("id", item.id)
      : await supabase.from("store_items").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(item ? "Item updated" : "Item added");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{item ? "Edit Store Item" : "Add Store Item"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Supplement, Medicine…" /></div>
            <div><Label>SKU</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" /></div>
          </div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Unit Price ₹ *</Label><Input type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} /></div>
            <div><Label>GST %</Label><Input type="number" min={0} max={100} value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} /></div>
            <div><Label>Unit</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="tablet, bottle" /></div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ParsedRow = {
  name: string;
  category?: string;
  sku?: string;
  description?: string;
  unit_price: number;
  gst_percentage?: number;
  unit?: string;
  _error?: string;
};

function ImportItemsModal({
  open, onClose, clinicId, onImported,
}: {
  open: boolean; onClose: () => void; clinicId: string; onImported: () => void;
}) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setRows([]); setFileName(""); }
  }, [open]);

  const downloadTemplate = () => {
    const csv = "name,category,sku,description,unit_price,gst_percentage,unit\nVitamin D3,Supplement,SUP-001,1000 IU tablets,250,5,bottle\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "store-items-template.csv";
    a.click();
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const parsed: ParsedRow[] = json.map((r) => {
      const name = String(r.name ?? "").trim();
      const unit_price = Number(r.unit_price ?? 0);
      const row: ParsedRow = {
        name,
        category: String(r.category ?? "").trim() || undefined,
        sku: String(r.sku ?? "").trim() || undefined,
        description: String(r.description ?? "").trim() || undefined,
        unit_price,
        gst_percentage: Number(r.gst_percentage ?? 0) || 0,
        unit: String(r.unit ?? "").trim() || "unit",
      };
      if (!name) row._error = "Missing name";
      else if (!unit_price || unit_price <= 0) row._error = "Invalid unit_price";
      return row;
    });
    setRows(parsed);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const validRows = rows.filter((r) => !r._error);
  const errorRows = rows.filter((r) => r._error);

  const confirmImport = async () => {
    if (validRows.length === 0) return toast.error("No valid rows to import");
    setImporting(true);
    const payload = validRows.map((r) => ({
      clinic_id: clinicId,
      name: r.name,
      category: r.category || null,
      sku: r.sku || null,
      description: r.description || null,
      unit_price: r.unit_price,
      gst_percentage: r.gst_percentage || 0,
      unit: r.unit || "unit",
      is_active: true,
    }));
    const { error } = await supabase.from("store_items").insert(payload);
    setImporting(false);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${validRows.length} items${errorRows.length ? ` · ${errorRows.length} skipped` : ""}`);
    onImported();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import Store Items</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileDown className="h-4 w-4 mr-1" /> Download Template
            </Button>
          </div>
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer hover:bg-muted/50"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm">{fileName || "Drag and drop a CSV or XLSX file, or click to browse"}</p>
            <input
              ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-semibold">{validRows.length}</span> valid ·{" "}
                <span className="text-destructive font-semibold">{errorRows.length}</span> errors ·{" "}
                <span>Preview (first 5 rows)</span>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 5).map((r, i) => (
                      <TableRow key={i} className={r._error ? "bg-destructive/10" : ""}>
                        <TableCell>{r.name || "—"}</TableCell>
                        <TableCell>{r.category || "—"}</TableCell>
                        <TableCell>{r.sku || "—"}</TableCell>
                        <TableCell className="text-right">₹{r.unit_price}</TableCell>
                        <TableCell className="text-right">{r.gst_percentage}%</TableCell>
                        <TableCell>{r.unit}</TableCell>
                        <TableCell className={r._error ? "text-destructive text-xs" : "text-green-600 text-xs"}>
                          {r._error || "OK"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {errorRows.length > 0 && rows.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  {errorRows.length} row(s) with errors will be skipped.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={confirmImport} disabled={importing || validRows.length === 0}>
            {importing ? "Importing..." : `Import ${validRows.length} Items`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
