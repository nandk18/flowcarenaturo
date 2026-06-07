import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
function CallTask({ clinicId }: { clinicId: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("clinic_id", clinicId)
        .in("lead_status", ["attempt1", "attempt2", "attempt3"])
        .lte("call_due_date", today)
        .order("call_due_date", { ascending: true });
      if (!cancelled) {
        setRows((data ?? []) as Patient[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clinicId]);

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-display text-lg font-semibold">Today's call tasks</h2>
        <p className="text-xs text-muted-foreground">Leads with a call due today or overdue</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Call Due</TableHead>
            <TableHead>SLA Breach</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No pending calls 🎉</TableCell></TableRow>
          ) : rows.map((p) => {
            const breach = p.sla_breach_days ?? 0;
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <button onClick={() => navigate(`/sales/patient/${p.id}`)} className="text-primary hover:underline font-medium">
                    {p.name}
                  </button>
                </TableCell>
                <TableCell className="text-sm">{p.phone ?? "—"}</TableCell>
                <TableCell>{statusBadge(p.lead_status)}</TableCell>
                <TableCell className="text-sm">{p.call_due_date ?? "—"}</TableCell>
                <TableCell className={cn("text-sm", breach > 0 && "text-red-600 font-semibold")}>
                  {breach > 0 ? `${breach}d` : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {p.phone && (
                    <Button variant="ghost" size="icon" asChild aria-label="WhatsApp">
                      <a href={`https://wa.me/${p.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4 text-green-600" />
                      </a>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------- Page ----------
export default function Sales() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as "leads" | "calls" | "add") || "leads";
  const [editing, setEditing] = useState<Patient | null>(null);

  const clinicId = profile?.clinic_id;

  const setTab = (next: string) => {
    setEditing(null);
    setSearchParams({ tab: next });
  };

  const handleSaved = (p: Patient) => {
    if (editing) {
      setEditing(null);
      setSearchParams({ tab: "leads" });
    } else {
      navigate(`/sales/patient/${p.id}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar />
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/home")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
        </Button>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {!clinicId ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            Loading clinic...
          </div>
        ) : (
          <Tabs value={editing ? "add" : tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="leads">Lead List</TabsTrigger>
              <TabsTrigger value="calls">Call Task</TabsTrigger>
              <TabsTrigger value="add">{editing ? "Edit Patient" : "Add a Lead"}</TabsTrigger>
            </TabsList>

            <TabsContent value="leads" className="mt-6">
              <LeadList clinicId={clinicId} onEdit={(p) => { setEditing(p); setSearchParams({ tab: "add" }); }} />
            </TabsContent>
            <TabsContent value="calls" className="mt-6">
              <CallTask clinicId={clinicId} />
            </TabsContent>
            <TabsContent value="add" className="mt-6 max-w-3xl">
              <LeadForm clinicId={clinicId} initial={editing} onSaved={handleSaved} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
