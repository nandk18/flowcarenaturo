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

const REQUIRED = ["first_name", "phone"];
const COLUMNS = [
  "first_name", "last_name", "phone", "email", "gender", "dob", "blood_group",
  "address", "lead_source", "convenient_time",
  "food_habits", "smoking", "alcohol", "sleep_hours", "dinner_time",
  "medication_history", "past_surgery_details",
  "allergies", "chronic_conditions",
];

const normalizePhone = (p: string) => {
  const digits = String(p || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
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
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
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
      first_name: "Jane", last_name: "Doe", phone: "+919876543210", email: "jane@example.com",
      gender: "female", dob: "1990-05-15", blood_group: "O+", address: "123 Main St",
      lead_source: "Instagram", convenient_time: "Evening",
      food_habits: "vegetarian", smoking: "never", alcohol: "never", sleep_hours: 7, dinner_time: "20:00",
      medication_history: "", past_surgery_details: "",
      allergies: "penicillin, dust", chronic_conditions: "",
    }];
    const csv = Papa.unparse({ fields: COLUMNS, data: sample });
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
        const rowNum = i + j + 2; // header is row 1
        const first = String(r.first_name || "").trim();
        const phone = normalizePhone(String(r.phone || ""));
        const name = `${first} ${String(r.last_name || "").trim()}`.trim();
        if (!first || !phone) {
          out.push({ row: rowNum, name: name || "(blank)", status: "error", reason: "Missing first_name or phone" });
          continue;
        }

        // duplicate check by phone within clinic
        const { data: existing } = await supabase
          .from("patients")
          .select("id")
          .eq("clinic_id", profile.clinic_id)
          .eq("phone", phone)
          .limit(1);
        if (existing && existing.length) {
          out.push({ row: rowNum, name, status: "skipped", reason: "Duplicate phone" });
          continue;
        }

        const toList = (v: any) => String(v || "").split(",").map(s => s.trim()).filter(Boolean);
        toInsert.push({
          clinic_id: profile.clinic_id,
          name,
          first_name: first,
          last_name: String(r.last_name || "").trim() || null,
          phone,
          email: r.email || null,
          gender: r.gender || null,
          dob: r.dob || null,
          blood_group: r.blood_group || null,
          address: r.address || null,
          lead_source: r.lead_source || null,
          convenient_time: r.convenient_time || null,
          food_habits: r.food_habits || null,
          smoking: r.smoking || null,
          alcohol: r.alcohol || null,
          sleep_hours: r.sleep_hours ? Number(r.sleep_hours) : null,
          dinner_time: r.dinner_time || null,
          medication_history: r.medication_history || null,
          past_surgery_details: r.past_surgery_details || null,
          allergies: r.allergies ? toList(r.allergies) : [],
          chronic_conditions: r.chronic_conditions ? toList(r.chronic_conditions) : [],
          lead_status: "attempt1",
          call_due_date: new Date().toISOString().slice(0, 10),
        });
        rowMeta.push({ row: rowNum, name });
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
              Required columns: <code className="text-foreground">first_name</code>, <code className="text-foreground">phone</code>. All other columns optional.
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
              <p className="text-xs text-muted-foreground mt-1">First row: {rows[0]?.first_name} {rows[0]?.last_name} ({rows[0]?.phone})</p>
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
