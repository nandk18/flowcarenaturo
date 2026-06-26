import { useState, useRef, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  XCircle,
  Eye,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type Row = Record<string, any>;
type ValidRow = {
  row: number;
  name: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  email: string | null;
  gender: string | null;
  dob: string | null;
};
type RowError = { row: number; name: string; phone: string; reason: string };
type ErrorDetail = {
  row: number;
  name: string;
  phone: string;
  reason: string;
  type: "duplicate" | "error";
};
type ImportJob = {
  id: string;
  file_name: string | null;
  status: string | null;
  total_rows: number | null;
  processed_rows: number | null;
  success_rows: number | null;
  duplicate_rows: number | null;
  error_rows: number | null;
  error_details: ErrorDetail[] | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
};

const ACTIVE_KEY = "active_import_job";
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
  const cleaned = s.split("T")[0];
  const m = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
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
const splitName = (v: any) => {
  const s = String(v || "").trim().replace(/\s+/g, " ");
  if (!s) return { first: "", last: null as string | null };
  const idx = s.indexOf(" ");
  if (idx === -1) return { first: s, last: null };
  return { first: s.slice(0, idx), last: s.slice(idx + 1) || null };
};

const isActive = (status?: string | null) =>
  status === "queued" || status === "processing" || status === null;
const statusBadge = (status?: string | null) => {
  if (status === "processing" || status === "queued")
    return <Badge className="animate-pulse bg-blue-500 text-white">In Progress</Badge>;
  if (status === "completed")
    return <Badge className="bg-green-600 text-white">Completed</Badge>;
  if (status === "partial")
    return <Badge className="bg-amber-500 text-white">Partial</Badge>;
  if (status === "failed")
    return <Badge className="bg-red-600 text-white">Failed</Badge>;
  return <Badge variant="secondary">{status ?? "—"}</Badge>;
};
const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString() : "—";

export default function PatientImportPage() {
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [validRows, setValidRows] = useState<ValidRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<RowError[]>([]);
  const [starting, setStarting] = useState(false);

  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [detailJob, setDetailJob] = useState<ImportJob | null>(null);

  // Load history + resume active job
  const loadHistory = async () => {
    if (!profile?.clinic_id) return;
    const { data } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(10);
    setHistory((data ?? []) as unknown as ImportJob[]);
  };

  useEffect(() => {
    if (!profile?.clinic_id) return;
    loadHistory();
    const stored = localStorage.getItem(ACTIVE_KEY);
    if (stored) {
      supabase
        .from("import_jobs")
        .select("*")
        .eq("id", stored)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) {
            localStorage.removeItem(ACTIVE_KEY);
            return;
          }
          setActiveJob(data as unknown as ImportJob);
          if (!isActive(data.status)) localStorage.removeItem(ACTIVE_KEY);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.clinic_id]);

  // Poll active job
  useEffect(() => {
    if (!activeJob?.id || !isActive(activeJob.status)) return;
    const id = activeJob.id;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("import_jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!data) return;
      setActiveJob(data as unknown as ImportJob);
      if (!isActive(data.status)) {
        localStorage.removeItem(ACTIVE_KEY);
        loadHistory();
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob?.id, activeJob?.status]);

  // Poll history if any in-progress row exists
  useEffect(() => {
    if (!history.some((h) => isActive(h.status))) return;
    const t = setInterval(loadHistory, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setValidRows([]);
    setInvalidRows([]);
    const ext = file.name.split(".").pop()?.toLowerCase();
    const onParsed = (data: Row[], fields: string[]) => {
      setRows(data);
      setHeaders(fields);
      validate(data, fields);
    };
    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => onParsed(res.data as Row[], res.meta.fields || []),
        error: (err) => toast.error(err.message),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "binary", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false });
        onParsed(data, Object.keys(data[0] || {}));
      };
      reader.readAsBinaryString(file);
    } else {
      toast.error("Upload a .csv, .xlsx or .xls file");
    }
  };

  const validate = (data: Row[], fields: string[]) => {
    const missing = REQUIRED.filter((c) => !fields.includes(c));
    if (missing.length) {
      toast.error(`Missing required columns: ${missing.join(", ")}`);
      return;
    }
    const valid: ValidRow[] = [];
    const errs: RowError[] = [];
    data.forEach((r, idx) => {
      const rowNum = idx + 2;
      const { first, last } = splitName(r.name);
      const phone = normalizePhone(r.phoneNumber);
      const fullName = [first, last].filter(Boolean).join(" ");
      if (!first || !phone) {
        errs.push({
          row: rowNum,
          name: fullName || "(blank)",
          phone: String(r.phoneNumber ?? ""),
          reason: "Missing name or phoneNumber",
        });
        return;
      }
      valid.push({
        row: rowNum,
        name: fullName,
        first_name: first,
        last_name: last,
        phone,
        email: r.email ? String(r.email).trim() || null : null,
        gender: mapGender(r.gender),
        dob: parseDob(r.dob),
      });
    });
    setValidRows(valid);
    setInvalidRows(errs);
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse({
      fields: TEMPLATE_COLUMNS,
      data: [
        {
          name: "Yuva Bharat",
          email: "yuva@example.com",
          phoneNumber: "+919876543210",
          dob: "1990-05-15",
          gender: "Male",
        },
      ],
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "patients-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const startImport = async () => {
    if (!profile?.clinic_id) return;
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setStarting(true);
    try {
      const profileId = await getProfileId();
      const { data: job, error } = await supabase
        .from("import_jobs")
        .insert({
          clinic_id: profile.clinic_id,
          created_by: profileId,
          status: "processing",
          file_name: fileName,
          total_rows: validRows.length,
          processed_rows: 0,
          success_rows: 0,
          duplicate_rows: 0,
          error_rows: 0,
          started_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error || !job) throw error ?? new Error("Failed to create job");

      localStorage.setItem(ACTIVE_KEY, job.id);
      setActiveJob(job as unknown as ImportJob);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const url = `https://amipgrjksrszocfzucxn.supabase.co/functions/v1/process-patient-import`;
      // Fire & forget
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaXBncmprc3Jzem9jZnp1Y3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NTI0NDIsImV4cCI6MjA5NjIyODQ0Mn0.-iFJ_US4PR9SBTyZyMetOtJ4N3nyvE0foeS-0BvSjBU",
        },
        body: JSON.stringify({
          job_id: job.id,
          patients: validRows,
          clinic_id: profile.clinic_id,
        }),
      }).catch((e) => console.error("import invoke failed", e));

      // Clear upload state
      setRows([]);
      setHeaders([]);
      setValidRows([]);
      setInvalidRows([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      loadHistory();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to start import");
    } finally {
      setStarting(false);
    }
  };

  const resetImport = () => {
    localStorage.removeItem(ACTIVE_KEY);
    setActiveJob(null);
    loadHistory();
  };

  const downloadErrorReport = (job: ImportJob) => {
    const details = job.error_details ?? [];
    if (!details.length) return;
    const csv = Papa.unparse(
      details.map((d) => ({
        row: d.row,
        name: d.name,
        phone: d.phone,
        type: d.type,
        reason: d.reason,
      })),
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${job.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const preview = useMemo(() => rows.slice(0, 5), [rows]);
  const progressPct = activeJob
    ? Math.round(
        ((activeJob.processed_rows ?? 0) / Math.max(1, activeJob.total_rows ?? 1)) *
          100,
      )
    : 0;
  const showUpload = !activeJob || !isActive(activeJob.status);

  return (
    <DashboardLayout title="Import Patients">
      <div className="max-w-4xl space-y-4">
        {/* ACTIVE / COMPLETED JOB CARD */}
        {activeJob && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                    {isActive(activeJob.status) ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        Import in Progress
                      </>
                    ) : activeJob.status === "completed" ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" /> Import
                        Complete
                      </>
                    ) : activeJob.status === "partial" ? (
                      <>
                        <AlertCircle className="h-5 w-5 text-amber-500" /> Partial
                        Import
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-600" /> Import Failed
                      </>
                    )}
                  </h2>
                  <p className="text-sm text-muted-foreground">{activeJob.file_name}</p>
                </div>
                {statusBadge(activeJob.status)}
              </div>

              {isActive(activeJob.status) && (
                <>
                  <Progress value={progressPct} />
                  <p className="text-xs text-muted-foreground">
                    {activeJob.processed_rows ?? 0} / {activeJob.total_rows ?? 0} rows
                  </p>
                </>
              )}

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded border bg-green-50 p-2">
                  <div className="text-xs text-muted-foreground">✅ Imported</div>
                  <div className="text-lg font-semibold text-green-700">
                    {activeJob.success_rows ?? 0}
                  </div>
                </div>
                <div className="rounded border bg-amber-50 p-2">
                  <div className="text-xs text-muted-foreground">⚠️ Duplicates</div>
                  <div className="text-lg font-semibold text-amber-700">
                    {activeJob.duplicate_rows ?? 0}
                  </div>
                </div>
                <div className="rounded border bg-red-50 p-2">
                  <div className="text-xs text-muted-foreground">❌ Errors</div>
                  <div className="text-lg font-semibold text-red-700">
                    {activeJob.error_rows ?? 0}
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Started: {fmtTime(activeJob.started_at)}
                {activeJob.completed_at &&
                  ` · Completed: ${fmtTime(activeJob.completed_at)}`}
              </p>

              {!isActive(activeJob.status) && (
                <>
                  {(activeJob.error_details?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Issues</h3>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadErrorReport(activeJob)}
                        >
                          <Download className="mr-2 h-3 w-3" /> Download error report
                        </Button>
                      </div>
                      <div className="max-h-64 overflow-auto rounded border text-xs">
                        <table className="w-full">
                          <thead className="bg-muted/50 text-left">
                            <tr>
                              <th className="px-2 py-1">Row</th>
                              <th className="px-2 py-1">Name</th>
                              <th className="px-2 py-1">Phone</th>
                              <th className="px-2 py-1">Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeJob.error_details!.map((d, i) => (
                              <tr key={i} className="border-t">
                                <td className="px-2 py-1">{d.row}</td>
                                <td className="px-2 py-1">{d.name}</td>
                                <td className="px-2 py-1">{d.phone}</td>
                                <td className="px-2 py-1 text-muted-foreground">
                                  {d.reason}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  <Button onClick={resetImport}>Import another file</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* UPLOAD */}
        {showUpload && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Upload CSV or Excel
                </h2>
                <p className="text-sm text-muted-foreground">
                  Columns: <code>name</code>, <code>email</code>,{" "}
                  <code>phoneNumber</code>, <code>dob</code>, <code>gender</code>.
                  Required: <code>name</code> and <code>phoneNumber</code>.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" /> Download template
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <Button onClick={() => fileRef.current?.click()} disabled={starting}>
                  <Upload className="mr-2 h-4 w-4" /> Choose file
                </Button>
              </div>

              {rows.length > 0 && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {fileName} · {rows.length} rows detected
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-700">{validRows.length} valid</span> ·{" "}
                      <span className="text-red-700">{invalidRows.length} errors</span>
                    </p>
                  </div>

                  <div className="overflow-auto rounded border bg-background">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          {headers.slice(0, 5).map((h) => (
                            <th key={h} className="px-2 py-1">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((r, i) => (
                          <tr key={i} className="border-t">
                            {headers.slice(0, 5).map((h) => (
                              <td key={h} className="px-2 py-1">
                                {String(r[h] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {invalidRows.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-red-700">
                        {invalidRows.length} rows will be skipped
                      </summary>
                      <div className="mt-1 max-h-32 space-y-1 overflow-auto">
                        {invalidRows.slice(0, 20).map((r) => (
                          <div key={r.row} className="text-muted-foreground">
                            Row {r.row}: {r.name} — {r.reason}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  <Button onClick={startImport} disabled={starting || validRows.length === 0}>
                    {starting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
                      </>
                    ) : (
                      `Start import (${validRows.length} patients)`
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* HISTORY */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-display font-semibold">Previous Imports</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No imports yet.</p>
            ) : (
              <div className="overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs">
                    <tr>
                      <th className="px-2 py-2">File</th>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Total</th>
                      <th className="px-2 py-2 text-green-700">Imported</th>
                      <th className="px-2 py-2 text-amber-700">Duplicates</th>
                      <th className="px-2 py-2 text-red-700">Errors</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const pct = Math.round(
                        ((h.processed_rows ?? 0) / Math.max(1, h.total_rows ?? 1)) * 100,
                      );
                      return (
                        <tr key={h.id} className="border-t align-top">
                          <td className="px-2 py-2">{h.file_name ?? "—"}</td>
                          <td className="px-2 py-2 text-xs text-muted-foreground">
                            {fmtTime(h.created_at)}
                          </td>
                          <td className="px-2 py-2">{h.total_rows ?? 0}</td>
                          <td className="px-2 py-2 text-green-700">
                            {h.success_rows ?? 0}
                          </td>
                          <td className="px-2 py-2 text-amber-700">
                            {h.duplicate_rows ?? 0}
                          </td>
                          <td className="px-2 py-2 text-red-700">
                            {h.error_rows ?? 0}
                          </td>
                          <td className="px-2 py-2">
                            {statusBadge(h.status)}
                            {isActive(h.status) && (
                              <div className="mt-1 w-24">
                                <Progress value={pct} className="h-1" />
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDetailJob(h)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detailJob} onOpenChange={(o) => !o && setDetailJob(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detailJob?.file_name ?? "Import details"}</DialogTitle>
          </DialogHeader>
          {detailJob && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                {statusBadge(detailJob.status)}
                <span className="text-xs text-muted-foreground">
                  {fmtTime(detailJob.created_at)}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>Total: {detailJob.total_rows ?? 0}</div>
                <div className="text-green-700">
                  Imported: {detailJob.success_rows ?? 0}
                </div>
                <div className="text-amber-700">
                  Duplicates: {detailJob.duplicate_rows ?? 0}
                </div>
                <div className="text-red-700">
                  Errors: {detailJob.error_rows ?? 0}
                </div>
              </div>
              {(detailJob.error_details?.length ?? 0) > 0 ? (
                <>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadErrorReport(detailJob)}
                    >
                      <Download className="mr-2 h-3 w-3" /> Download error report
                    </Button>
                  </div>
                  <div className="max-h-96 overflow-auto rounded border text-xs">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-muted/50 text-left">
                        <tr>
                          <th className="px-2 py-1">Row</th>
                          <th className="px-2 py-1">Name</th>
                          <th className="px-2 py-1">Phone</th>
                          <th className="px-2 py-1">Type</th>
                          <th className="px-2 py-1">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailJob.error_details!.map((d, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1">{d.row}</td>
                            <td className="px-2 py-1">{d.name}</td>
                            <td className="px-2 py-1">{d.phone}</td>
                            <td className="px-2 py-1">{d.type}</td>
                            <td className="px-2 py-1 text-muted-foreground">
                              {d.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">No issues recorded.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
