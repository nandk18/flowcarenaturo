import { useState, useRef } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type Row = Record<string, any>;
type RowResult = { row: number; name: string; status: "inserted" | "skipped" | "error"; reason?: string };

const REQUIRED = ["name", "phoneNumber"];
const TEMPLATE_COLUMNS = ["name", "email", "phoneNumber", "dob", "gender"];

const normalizePhone = (p: string) => {
  const raw = String(p || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw.replace(/\s+/g, "");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
};

const parseDob = (v: any): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return null;
  // Strip T... suffix
  const cleaned = s.split("T")[0];
  // Accept YYYY-MM-DD or YYYY/MM/DD
  const m = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const [_, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dt = new Date(cleaned);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
};

const mapGender = (v: any): string | null => {
  const s = String(v || "").trim().toLowerCase();
  if (s === "male") return "Male";
  if (s === "female") return "Female";
  if (s === "other") return "Other";
  return null;
};

const splitName = (v: any): { first: string; last: string | null } => {
  const s = String(v || "").trim().replace(/\s+/g, " ");
  if (!s) return { first: "", last: null };
  const idx = s.indexOf(" ");
  if (idx === -1) return { first: s, last: null };
  return { first: s.slice(0, idx), last: s.slice(idx + 1) || null };
};

export default function PatientImportPage() {
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[]>([]);

  const handleFile = (file: File) => {
    setResults([]);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          setRows(res.data as Row[]);
          setHeaders(res.meta.fields || []);
        },
        error: (err) => toast.error(err.message),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "binary", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false });
        setRows(data);
        setHeaders(Object.keys(data[0] || {}));
      };
      reader.readAsBinaryString(file);
    } else {
      toast.error("Upload a .csv, .xlsx or .xls file");
    }
  };

  const downloadTemplate = () => {
    const sample = [{
      name: "Yuva Bharat",
      email: "yuva@example.com",
      phoneNumber: "+919876543210",
      dob: "1990-05-15",
      gender: "Male",
    }];
    const csv = Papa.unparse({ fields: TEMPLATE_COLUMNS, data: sample });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "patients-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const startImport = async () => {
    if (!profile?.clinic_id) return;
    if (rows.length === 0) { toast.error("No rows to import"); return; }
    const missing = REQUIRED.filter(c => !headers.includes(c));
    if (missing.length) { toast.error(`Missing required columns: ${missing.join(", ")}`); return; }

    setImporting(true);
    setProgress(0);
    setResults([]);
    const out: RowResult[] = [];
    const batchSize = 50;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const toInsert: any[] = [];
      const rowMeta: { row: number; name: string }[] = [];

      for (let j = 0; j < batch.length; j++) {
        const r = batch[j];
        const rowNum = i + j + 2;
        const { first, last } = splitName(r.name);
        const phone = normalizePhone(r.phoneNumber);
        const fullName = [first, last].filter(Boolean).join(" ");

        if (!first || !phone) {
          out.push({ row: rowNum, name: fullName || "(blank)", status: "error", reason: "Missing name or phoneNumber" });
          continue;
        }

        const { data: existing } = await supabase
          .from("patients")
          .select("id")
          .eq("clinic_id", profile.clinic_id)
          .eq("phone", phone)
          .limit(1);
        if (existing && existing.length) {
          out.push({ row: rowNum, name: fullName, status: "skipped", reason: "Duplicate phone" });
          continue;
        }

        toInsert.push({
          clinic_id: profile.clinic_id,
          name: fullName,
          first_name: first,
          last_name: last,
          phone,
          email: r.email ? String(r.email).trim() || null : null,
          gender: mapGender(r.gender),
          dob: parseDob(r.dob),
          lead_status: "current",
          call_due_date: null,
        });
        rowMeta.push({ row: rowNum, name: fullName });
      }

      if (toInsert.length) {
        const { error, data } = await supabase.from("patients").insert(toInsert).select("id");
        if (error) {
          rowMeta.forEach(m => out.push({ ...m, status: "error", reason: error.message }));
        } else {
          rowMeta.forEach((m, idx) => out.push({ ...m, status: "inserted", reason: data?.[idx]?.id }));
        }
      }

      setResults([...out]);
      setProgress(Math.round(((i + batch.length) / rows.length) * 100));
    }

    setImporting(false);
    const inserted = out.filter(r => r.status === "inserted").length;
    const skipped = out.filter(r => r.status === "skipped").length;
    const errors = out.filter(r => r.status === "error").length;
    toast.success(`Import complete: ${inserted} added, ${skipped} skipped, ${errors} errors`);
  };

  return (
    <DashboardLayout title="Import Patients">
      <div className="max-w-3xl space-y-4">
        <Card><CardContent className="p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Upload CSV or Excel</h2>
            <p className="text-sm text-muted-foreground">
              Columns: <code className="text-foreground">name</code>, <code className="text-foreground">email</code>, <code className="text-foreground">phoneNumber</code>, <code className="text-foreground">dob</code>, <code className="text-foreground">gender</code>.
              Required: <code className="text-foreground">name</code> and <code className="text-foreground">phoneNumber</code>. <code>createdAt</code> is ignored.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" /> Download template</Button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <Button onClick={() => fileRef.current?.click()} disabled={importing}><Upload className="mr-2 h-4 w-4" /> Choose file</Button>
          </div>

          {rows.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{rows.length} rows detected · {headers.length} columns</p>
              <p className="text-xs text-muted-foreground mt-1">First row: {rows[0]?.name} ({rows[0]?.phoneNumber})</p>
              <Button className="mt-3" onClick={startImport} disabled={importing}>
                {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</> : <>Start import</>}
              </Button>
            </div>
          )}

          {importing && <Progress value={progress} />}
        </CardContent></Card>

        {results.length > 0 && (
          <Card><CardContent className="p-4 space-y-2">
            <h3 className="font-display font-semibold">Results</h3>
            <div className="max-h-96 overflow-auto space-y-1">
              {results.map((r) => (
                <div key={`${r.row}-${r.name}`} className="flex items-start gap-2 text-xs border-b py-1">
                  {r.status === "inserted" ? <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" /> :
                   r.status === "skipped" ? <AlertCircle className="h-3.5 w-3.5 text-warning mt-0.5 flex-shrink-0" /> :
                   <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />}
                  <span className="text-muted-foreground w-12">Row {r.row}</span>
                  <span className="flex-1">{r.name}</span>
                  <span className="capitalize text-muted-foreground">{r.status}</span>
                  {r.reason && r.status !== "inserted" && <span className="text-muted-foreground italic">{r.reason}</span>}
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}
      </div>
    </DashboardLayout>
  );
}
