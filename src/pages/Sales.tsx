import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, Phone, UserPlus, Settings as SettingsIcon, Home as HomeIcon, LogOut } from "lucide-react";
import Logo from "@/components/Logo";
import { useClinic } from "@/hooks/useClinic";
import { cn as cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MessageCircle,
  Pencil,
  Download,
  FileSpreadsheet,
  Search,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  PhoneOff,
  RotateCw,
  XCircle,
  CalendarCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

type LeadStatus = "attempt1" | "attempt2" | "attempt3" | "closed" | "current";

type Patient = {
  id: string;
  clinic_id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  lead_status: LeadStatus | null;
  call_due_date: string | null;
  sla_breach_days: number | null;
  created_at: string | null;
};

type ContactNote = { patient_id: string; note: string; created_at: string };

const STATUS_OPTIONS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "attempt1", label: "Attempt 1" },
  { value: "attempt2", label: "Attempt 2" },
  { value: "attempt3", label: "Attempt 3" },
  { value: "closed", label: "Closed" },
  { value: "current", label: "Current" },
];

const STATUS_STYLES: Record<LeadStatus, string> = {
  attempt1: "bg-yellow-100 text-yellow-800 border-yellow-200",
  attempt2: "bg-orange-100 text-orange-800 border-orange-200",
  attempt3: "bg-red-100 text-red-800 border-red-200",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
  current: "bg-green-100 text-green-800 border-green-200",
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const GENDERS = ["Male", "Female", "Other"];

const PAGE_SIZE = 20;

function normalizePhone(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed.replace(/\s+/g, "");
  return "+91" + trimmed.replace(/[^\d]/g, "");
}

function statusBadge(status: LeadStatus | null) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_STYLES[status],
      )}
    >
      {status}
    </span>
  );
}

// ---------- Lead Form ----------
type LeadFormProps = {
  clinicId: string;
  initial?: Patient | null;
  onSaved: (patient: Patient) => void;
};

export function LeadForm({ clinicId, initial, onSaved }: LeadFormProps) {
  const [firstName, setFirstName] = useState(initial?.first_name ?? "");
  const [lastName, setLastName] = useState(initial?.last_name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "+91");
  const [dob, setDob] = useState(initial?.dob ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [bloodGroup, setBloodGroup] = useState(initial?.blood_group ?? "");
  const [ecName, setEcName] = useState(initial?.emergency_contact_name ?? "");
  const [ecPhone, setEcPhone] = useState(initial?.emergency_contact_phone ?? "");
  const [ecRelation, setEcRelation] = useState(initial?.emergency_contact_relation ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(initial);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }
    if (!phone.trim() || phone.trim() === "+91") {
      toast.error("Phone number is required");
      return;
    }
    setSubmitting(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const payload = {
      clinic_id: clinicId,
      name: fullName,
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      phone: normalizePhone(phone),
      email: email.trim() || null,
      dob: dob || null,
      gender: gender || null,
      blood_group: bloodGroup || null,
      address: address.trim() || null,
      emergency_contact_name: ecName.trim() || null,
      emergency_contact_phone: ecPhone ? normalizePhone(ecPhone) : null,
      emergency_contact_relation: ecRelation.trim() || null,
    };

    let result;
    if (isEdit && initial) {
      result = await supabase
        .from("patients")
        .update(payload)
        .eq("id", initial.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("patients")
        .insert({
          ...payload,
          lead_status: "attempt1",
          call_due_date: new Date().toISOString().slice(0, 10),
        })
        .select()
        .single();
    }

    setSubmitting(false);
    if (result.error || !result.data) {
      toast.error(result.error?.message ?? "Failed to save");
      return;
    }
    toast.success(isEdit ? "Patient updated" : "Lead added successfully");
    onSaved(result.data as Patient);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 rounded-2xl border bg-card p-6 shadow-card">
      <h2 className="font-display text-xl font-semibold">
        {isEdit ? "Edit Patient" : "Add a Lead"}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First Name *</Label>
          <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last Name</Label>
          <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Gender</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent>
              {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Blood Group</Label>
          <Select value={bloodGroup} onValueChange={setBloodGroup}>
            <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
            <SelectContent>
              {BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ecName">Emergency Contact Name</Label>
          <Input id="ecName" value={ecName} onChange={(e) => setEcName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ecPhone">Emergency Contact Phone</Label>
          <Input id="ecPhone" type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ecRelation">Relation</Label>
          <Input id="ecRelation" value={ecRelation} onChange={(e) => setEcRelation(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Add lead"}
        </Button>
      </div>
    </form>
  );
}

// ---------- Lead List ----------
type LeadListProps = {
  clinicId: string;
  onEdit: (patient: Patient) => void;
};

function LeadList({ clinicId, onEdit }: LeadListProps) {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [notesByPatient, setNotesByPatient] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: patientsData } = await supabase
        .from("patients")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const rows = (patientsData ?? []) as Patient[];
      setPatients(rows);

      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const { data: notes } = await supabase
          .from("contact_notes")
          .select("patient_id, note, created_at")
          .in("patient_id", ids)
          .order("created_at", { ascending: false });
        const map: Record<string, string> = {};
        ((notes ?? []) as ContactNote[]).forEach((n) => {
          if (n.patient_id && !map[n.patient_id]) map[n.patient_id] = n.note;
        });
        if (!cancelled) setNotesByPatient(map);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [clinicId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      if (statusFilter !== "all" && p.lead_status !== statusFilter) return false;
      if (q && !(p.name?.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q))) return false;
      if (fromDate && p.created_at && p.created_at < fromDate) return false;
      if (toDate && p.created_at && p.created_at > toDate + "T23:59:59") return false;
      return true;
    });
  }, [patients, statusFilter, search, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [statusFilter, search, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportRows = () =>
    filtered.map((p) => ({
      Name: p.name,
      Phone: p.phone ?? "",
      Status: p.lead_status ?? "",
      "Call Due": p.call_due_date ?? "",
      "SLA Breach (days)": p.sla_breach_days ?? 0,
      "Last Note": notesByPatient[p.id] ?? "",
      "Added On": p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
    }));

  const exportCsv = () => {
    const rows = exportRows();
    if (!rows.length) { toast.error("Nothing to export"); return; }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => {
          const v = String((r as any)[h] ?? "").replace(/"/g, '""');
          return /[",\n]/.test(v) ? `"${v}"` : v;
        }).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = () => {
    const rows = exportRows();
    if (!rows.length) { toast.error("Nothing to export"); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | "all")}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[150px]" />
        </div>
        <div className="relative flex-1 min-w-[200px] space-y-1">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or phone"
              className="pl-9"
            />
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportXlsx}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Call Due</TableHead>
              <TableHead>SLA Breach</TableHead>
              <TableHead>Last Note</TableHead>
              <TableHead>Added On</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No leads found</TableCell></TableRow>
            ) : pageRows.map((p) => {
              const lastNote = notesByPatient[p.id];
              const breach = p.sla_breach_days ?? 0;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => navigate(`/sales/patient/${p.id}`)}
                      className="text-primary hover:underline font-medium"
                    >
                      {p.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm">{p.phone ?? "—"}</TableCell>
                  <TableCell>{statusBadge(p.lead_status)}</TableCell>
                  <TableCell className="text-sm">{p.call_due_date ?? "—"}</TableCell>
                  <TableCell className={cn("text-sm", breach > 0 && "text-red-600 font-semibold")}>
                    {breach > 0 ? `${breach}d` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                    {lastNote ? lastNote.slice(0, 40) + (lastNote.length > 40 ? "..." : "") : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      {p.phone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          aria-label="WhatsApp"
                        >
                          <a
                            href={`https://wa.me/${p.phone.replace(/[^\d]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-4 w-4 text-green-600" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => onEdit(p)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span className="px-2 py-1">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Call Task ----------
type CallOutcome = "no_answer" | "follow_up" | "not_interested" | "booked";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function diffDays(fromISO: string, toISO: string) {
  const a = new Date(fromISO + "T00:00:00").getTime();
  const b = new Date(toISO + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

function CallTaskRow({
  patient,
  onAction,
}: {
  patient: Patient;
  onAction: (p: Patient, outcome: CallOutcome, note: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const today = todayISO();
  const due = patient.call_due_date;
  let sla: { label: string; cls: string } = { label: "—", cls: "text-muted-foreground" };
  if (due) {
    if (due < today) {
      const days = diffDays(due, today);
      sla = { label: `Overdue ${days} day${days === 1 ? "" : "s"}`, cls: "text-red-600 font-semibold" };
    } else if (due === today) {
      sla = { label: "Due Today", cls: "text-yellow-700 font-semibold" };
    } else {
      sla = { label: `Due ${due}`, cls: "text-blue-600 font-medium" };
    }
  }

  const handle = async (outcome: CallOutcome) => {
    setBusy(true);
    try {
      await onAction(patient, outcome, note.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {statusBadge(patient.lead_status)}
        <button
          onClick={() => navigate(`/sales/patient/${patient.id}`)}
          className="font-medium text-primary hover:underline"
        >
          {patient.name}
        </button>
        <span className={cn("ml-auto text-xs", sla.cls)}>{sla.label}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{patient.phone ?? "—"}</span>
        {patient.phone && (
          <Button variant="ghost" size="icon" asChild aria-label="WhatsApp" className="h-7 w-7">
            <a
              href={`https://wa.me/${patient.phone.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4 text-green-600" />
            </a>
          </Button>
        )}
      </div>
      <Textarea
        rows={2}
        placeholder="Add a note..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={busy}>
              Log Call <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => handle("no_answer")}>
              <PhoneOff className="mr-2 h-4 w-4" /> No Answer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handle("follow_up")}>
              <RotateCw className="mr-2 h-4 w-4" /> Follow Up
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handle("not_interested")}>
              <XCircle className="mr-2 h-4 w-4" /> Not Interested
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handle("booked")}>
              <CalendarCheck className="mr-2 h-4 w-4" /> Appointment Booked
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function CallSection({
  title,
  color,
  rows,
  onAction,
  defaultOpen = true,
}: {
  title: string;
  color: "red" | "yellow" | "blue";
  rows: Patient[];
  onAction: (p: Patient, outcome: CallOutcome, note: string) => Promise<void>;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const headerCls = {
    red: "bg-red-50 text-red-700 border-red-200",
    yellow: "bg-yellow-50 text-yellow-800 border-yellow-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  }[color];
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-card overflow-hidden">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn("flex w-full items-center gap-2 border-b px-4 py-3 text-left", headerCls)}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
          <span className="font-semibold uppercase tracking-wide text-sm">{title}</span>
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold">
            {rows.length}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 p-4">
          {rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No leads in this group</p>
          ) : (
            rows.map((p) => <CallTaskRow key={p.id} patient={p} onAction={onAction} />)
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CallTask({ clinicId }: { clinicId: string }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [doneToday, setDoneToday] = useState(0);

  const load = async () => {
    setLoading(true);
    const today = todayISO();
    const [patientsRes, callsRes] = await Promise.all([
      supabase
        .from("patients")
        .select("*")
        .eq("clinic_id", clinicId)
        .in("lead_status", ["attempt1", "attempt2", "attempt3"]),
      supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .gte("called_at", today + "T00:00:00")
        .lte("called_at", today + "T23:59:59"),
    ]);
    setRows((patientsRes.data ?? []) as Patient[]);
    setDoneToday(callsRes.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const today = todayISO();
  const { overdue, dueToday, upcoming } = useMemo(() => {
    const overdue: Patient[] = [];
    const dueToday: Patient[] = [];
    const upcoming: Patient[] = [];
    for (const p of rows) {
      const d = p.call_due_date;
      if (!d) continue;
      if (d < today) overdue.push(p);
      else if (d === today) dueToday.push(p);
      else upcoming.push(p);
    }
    overdue.sort((a, b) => (b.sla_breach_days ?? 0) - (a.sla_breach_days ?? 0));
    dueToday.sort((a, b) => (b.lead_status ?? "").localeCompare(a.lead_status ?? ""));
    upcoming.sort((a, b) => (a.call_due_date ?? "").localeCompare(b.call_due_date ?? ""));
    return { overdue, dueToday, upcoming };
  }, [rows, today]);

  const handleAction = async (p: Patient, outcome: CallOutcome, note: string) => {
    const current = (p.lead_status ?? "attempt1") as LeadStatus;
    let nextStatus: LeadStatus = current;
    let nextDue: string | null = p.call_due_date;
    let nextBreach: number = p.sla_breach_days ?? 0;
    let removeFromQueue = false;
    let navigateAfter: string | null = null;

    if (outcome === "no_answer") {
      if (current === "attempt3") {
        nextStatus = "closed";
        removeFromQueue = true;
      } else {
        nextDue = addDaysISO(1);
        nextBreach = 0;
      }
    } else if (outcome === "follow_up") {
      if (current === "attempt1") {
        nextStatus = "attempt2";
        nextDue = addDaysISO(2);
      } else if (current === "attempt2") {
        nextStatus = "attempt3";
        nextDue = addDaysISO(3);
      } else {
        nextStatus = "attempt3";
        nextDue = addDaysISO(3);
      }
      nextBreach = 0;
    } else if (outcome === "not_interested") {
      nextStatus = "closed";
      removeFromQueue = true;
    } else if (outcome === "booked") {
      nextStatus = "current";
      removeFromQueue = true;
      navigateAfter = `/consult/appointments/new?patient_id=${p.id}&from=sales`;
    }

    const { error: logError } = await supabase.from("call_logs").insert({
      patient_id: p.id,
      clinic_id: p.clinic_id,
      outcome,
      notes: note || null,
      called_by: profile?.id ?? null,
      called_at: new Date().toISOString(),
    });
    if (logError) {
      toast.error(logError.message);
      return;
    }

    if (note) {
      await supabase.from("contact_notes").insert({
        patient_id: p.id,
        clinic_id: p.clinic_id,
        note,
        created_by: profile?.id ?? null,
      });
    }

    const { error: updError } = await supabase
      .from("patients")
      .update({
        lead_status: nextStatus,
        call_due_date: nextDue,
        sla_breach_days: nextBreach,
      })
      .eq("id", p.id);
    if (updError) {
      toast.error(updError.message);
      return;
    }

    toast.success(
      outcome === "no_answer"
        ? "Logged: No answer"
        : outcome === "follow_up"
        ? "Logged: Follow up scheduled"
        : outcome === "not_interested"
        ? "Lead closed"
        : "Appointment booked",
    );

    setDoneToday((n) => n + 1);
    if (removeFromQueue) {
      setRows((prev) => prev.filter((x) => x.id !== p.id));
    } else {
      setRows((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? { ...x, lead_status: nextStatus, call_due_date: nextDue, sla_breach_days: nextBreach }
            : x,
        ),
      );
    }
    if (navigateAfter) navigate(navigateAfter);
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Loading call tasks...
      </div>
    );
  }

  const Pill = ({ icon, label, count, cls }: { icon: string; label: string; count: number; cls: string }) => (
    <div className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium", cls)}>
      <span>{icon}</span>
      <span>{label}:</span>
      <span className="font-bold">{count}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Pill icon="🔴" label="Overdue" count={overdue.length} cls="bg-red-50 text-red-700 border-red-200" />
        <Pill icon="🟡" label="Due Today" count={dueToday.length} cls="bg-yellow-50 text-yellow-800 border-yellow-200" />
        <Pill icon="🔵" label="Upcoming" count={upcoming.length} cls="bg-blue-50 text-blue-700 border-blue-200" />
        <Pill icon="✅" label="Done Today" count={doneToday} cls="bg-green-50 text-green-700 border-green-200" />
      </div>

      <CallSection title="Overdue" color="red" rows={overdue} onAction={handleAction} />
      <CallSection title="Due Today" color="yellow" rows={dueToday} onAction={handleAction} />
      <CallSection title="Upcoming" color="blue" rows={upcoming} onAction={handleAction} defaultOpen={false} />
    </div>
  );
}

// ---------- Page ----------
type SalesSection = "leads" | "call-task" | "add-lead";

const SIDEBAR_ITEMS: { id: SalesSection; label: string; icon: typeof Users; path: string }[] = [
  { id: "leads", label: "Lead List", icon: Users, path: "/sales/leads" },
  { id: "call-task", label: "Call Task", icon: Phone, path: "/sales/call-task" },
  { id: "add-lead", label: "Add a Lead", icon: UserPlus, path: "/sales/add-lead" },
];

export default function Sales() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { clinic } = useClinic();
  const [editing, setEditing] = useState<Patient | null>(null);

  const clinicId = profile?.clinic_id;

  const active: SalesSection = location.pathname.includes("/call-task")
    ? "call-task"
    : location.pathname.includes("/add-lead")
    ? "add-lead"
    : "leads";

  const goTo = (section: SalesSection) => {
    if (section !== "add-lead") setEditing(null);
    navigate(`/sales/${section}`);
  };

  const handleSaved = (p: Patient) => {
    if (editing) {
      setEditing(null);
      navigate("/sales/leads");
    } else {
      navigate(`/sales/patient/${p.id}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const sectionTitle = SIDEBAR_ITEMS.find((s) => s.id === active)?.label ?? "Sales";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 flex-col gradient-sidebar md:flex">
        <div className="flex h-16 items-center gap-3 px-6 bg-sidebar-accent/40">
          <Logo height={32} className="dark:invert-0 dark:mix-blend-normal" />
          {clinic?.name && (
            <span className="font-display text-sm font-semibold text-sidebar-foreground truncate">
              {clinic.name}
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-1">
          <button
            type="button"
            onClick={() => navigate("/dashboard/settings")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <SettingsIcon className="h-4 w-4" />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <HomeIcon className="h-4 w-4" />
            <span>Back to Home</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Logo height={32} className="md:hidden" />
            <h1 className="font-display text-lg font-semibold">Sales · {sectionTitle}</h1>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {!clinicId ? (
            <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
              Loading clinic...
            </div>
          ) : active === "leads" ? (
            <LeadList
              clinicId={clinicId}
              onEdit={(p) => { setEditing(p); navigate("/sales/add-lead"); }}
            />
          ) : active === "call-task" ? (
            <CallTask clinicId={clinicId} />
          ) : (
            <div className="max-w-3xl">
              <LeadForm clinicId={clinicId} initial={editing} onSaved={handleSaved} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
