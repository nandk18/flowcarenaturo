import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, Phone, UserPlus } from "lucide-react";
import SalesShell from "@/components/layout/SalesShell";
import { useClinic } from "@/hooks/useClinic";
import { normalizeAlcohol, normalizeSmoking, normalizeFoodHabits } from "@/lib/lifestyleNormalize";
import { useUrlState } from "@/hooks/useUrlState";
import { usePersistedForm } from "@/hooks/usePersistedForm";
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt";
import RestoreBanner from "@/components/RestoreBanner";

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
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
  convenient_time: string | null;
  lead_source: string | null;
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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
  /** Pre-fill values when creating a brand new lead (ignored if initial is set). */
  prefill?: { first_name?: string; last_name?: string; phone?: string };
};

export function LeadForm({ clinicId, initial, onSaved, prefill }: LeadFormProps) {
  const [leadSource, setLeadSource] = useState(initial?.lead_source ?? "");
  const [firstName, setFirstName] = useState(initial?.first_name ?? prefill?.first_name ?? "");
  const [lastName, setLastName] = useState(initial?.last_name ?? prefill?.last_name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? prefill?.phone ?? "+91");
  const [convenientTime, setConvenientTime] = useState(initial?.convenient_time ?? "");
  const [dob, setDob] = useState(initial?.dob ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [bloodGroup, setBloodGroup] = useState(initial?.blood_group ?? "");
  const [ecName, setEcName] = useState(initial?.emergency_contact_name ?? "");
  const [ecPhone, setEcPhone] = useState(initial?.emergency_contact_phone ?? "");
  const [ecRelation, setEcRelation] = useState(initial?.emergency_contact_relation ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [foodHabits, setFoodHabits] = useState((initial as any)?.food_habits ?? "");
  const [smoking, setSmoking] = useState((initial as any)?.smoking ?? "");
  const [alcohol, setAlcohol] = useState((initial as any)?.alcohol ?? "");
  const [sleepHours, setSleepHours] = useState<string>((initial as any)?.sleep_hours?.toString() ?? "");
  const [dinnerTime, setDinnerTime] = useState((initial as any)?.dinner_time ?? "");
  const [medicationHistory, setMedicationHistory] = useState((initial as any)?.medication_history ?? "");
  const [pastSurgery, setPastSurgery] = useState((initial as any)?.past_surgery_details ?? "");
  const [allergiesText, setAllergiesText] = useState(Array.isArray((initial as any)?.allergies) ? (initial as any).allergies.join(", ") : "");
  const [chronicText, setChronicText] = useState(Array.isArray((initial as any)?.chronic_conditions) ? (initial as any).chronic_conditions.join(", ") : "");
  const [duplicates, setDuplicates] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(initial);

  // -------- Draft persistence (localStorage) --------
  const persistKey = isEdit ? `edit_patient_${initial!.id}` : "add_patient";
  const FIELD_SETTERS = useMemo(() => ({
    leadSource: setLeadSource, firstName: setFirstName, lastName: setLastName, phone: setPhone,
    convenientTime: setConvenientTime, dob: setDob, gender: setGender, email: setEmail,
    bloodGroup: setBloodGroup, ecName: setEcName, ecPhone: setEcPhone, ecRelation: setEcRelation,
    address: setAddress, foodHabits: setFoodHabits, smoking: setSmoking, alcohol: setAlcohol,
    sleepHours: setSleepHours, dinnerTime: setDinnerTime, medicationHistory: setMedicationHistory,
    pastSurgery: setPastSurgery, allergiesText: setAllergiesText, chronicText: setChronicText,
  }), []);
  const currentValues = {
    leadSource, firstName, lastName, phone, convenientTime, dob, gender, email, bloodGroup,
    ecName, ecPhone, ecRelation, address, foodHabits, smoking, alcohol, sleepHours, dinnerTime,
    medicationHistory, pastSurgery, allergiesText, chronicText,
  };
  const initialSnapshot = useMemo(() => JSON.stringify(currentValues), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`flowcare_form_${persistKey}`);
      if (raw) {
        const saved = JSON.parse(raw);
        if (JSON.stringify(saved) !== initialSnapshot) {
          Object.entries(saved).forEach(([k, v]) => {
            const setter = (FIELD_SETTERS as any)[k];
            if (setter) setter(v as any);
          });
          setShowRestoreBanner(true);
        }
      }
    } catch { /* ignore */ }
    setDraftLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(`flowcare_form_${persistKey}`, JSON.stringify(currentValues));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, Object.values(currentValues));

  const clearDraft = () => {
    try { localStorage.removeItem(`flowcare_form_${persistKey}`); } catch { /* ignore */ }
  };
  const resetToInitial = () => {
    clearDraft();
    Object.entries({
      leadSource: initial?.lead_source ?? "",
      firstName: initial?.first_name ?? prefill?.first_name ?? "",
      lastName: initial?.last_name ?? prefill?.last_name ?? "",
      phone: initial?.phone ?? prefill?.phone ?? "+91",
      convenientTime: initial?.convenient_time ?? "",
      dob: initial?.dob ?? "",
      gender: initial?.gender ?? "",
      email: initial?.email ?? "",
      bloodGroup: initial?.blood_group ?? "",
      ecName: initial?.emergency_contact_name ?? "",
      ecPhone: initial?.emergency_contact_phone ?? "",
      ecRelation: initial?.emergency_contact_relation ?? "",
      address: initial?.address ?? "",
      foodHabits: (initial as any)?.food_habits ?? "",
      smoking: (initial as any)?.smoking ?? "",
      alcohol: (initial as any)?.alcohol ?? "",
      sleepHours: (initial as any)?.sleep_hours?.toString() ?? "",
      dinnerTime: (initial as any)?.dinner_time ?? "",
      medicationHistory: (initial as any)?.medication_history ?? "",
      pastSurgery: (initial as any)?.past_surgery_details ?? "",
      allergiesText: Array.isArray((initial as any)?.allergies) ? (initial as any).allergies.join(", ") : "",
      chronicText: Array.isArray((initial as any)?.chronic_conditions) ? (initial as any).chronic_conditions.join(", ") : "",
    }).forEach(([k, v]) => {
      const setter = (FIELD_SETTERS as any)[k];
      if (setter) setter(v as any);
    });
    setShowRestoreBanner(false);
  };
  const isDirty = draftLoaded && JSON.stringify(currentValues) !== initialSnapshot;
  useUnsavedChangesPrompt(isDirty && !submitting);

  const checkDuplicates = async (): Promise<boolean> => {
    if (isEdit) return false;
    const normalized = normalizePhone(phone);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const { data } = await supabase
      .from("patients")
      .select("id, name, phone")
      .eq("clinic_id", clinicId)
      .or(`phone.eq.${normalized},name.ilike.${fullName}`)
      .limit(5);
    if (data && data.length > 0) {
      setDuplicates(data as any);
      return true;
    }
    return false;
  };

  const performSave = async () => {
    setSubmitting(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const toList = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
    const payload: any = {
      clinic_id: clinicId,
      name: fullName,
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      phone: normalizePhone(phone),
      convenient_time: convenientTime.trim() || null,
      lead_source: leadSource.trim() || null,
      email: email.trim() || null,
      dob: dob || null,
      gender: gender || null,
      blood_group: bloodGroup || null,
      address: address.trim() || null,
      emergency_contact_name: ecName.trim() || null,
      emergency_contact_phone: ecPhone ? normalizePhone(ecPhone) : null,
      emergency_contact_relation: ecRelation.trim() || null,
      food_habits: normalizeFoodHabits(foodHabits),
      smoking: normalizeSmoking(smoking),
      alcohol: normalizeAlcohol(alcohol),
      sleep_hours: sleepHours ? Number(sleepHours) : null,
      dinner_time: dinnerTime || null,
      medication_history: medicationHistory.trim() || null,
      past_surgery_details: pastSurgery.trim() || null,
      allergies: allergiesText ? toList(allergiesText) : [],
      chronic_conditions: chronicText ? toList(chronicText) : [],
    };

    try {
      let result;
      if (isEdit && initial) {
        result = await supabase.from("patients").update(payload).eq("id", initial.id).select().single();
      } else {
        result = await supabase.from("patients").insert({
          ...payload,
          lead_status: "attempt1",
          call_due_date: new Date().toISOString().slice(0, 10),
        }).select().single();
      }
      if (result.error || !result.data) {
        toast.error(result.error?.message ?? "Failed to save");
        return;
      }
      toast.success(isEdit ? "Patient updated" : "Lead added successfully");
      clearDraft();
      onSaved(result.data as Patient);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save lead");
    } finally {
      setSubmitting(false);
      setDuplicates([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) { toast.error("First name is required"); return; }
    if (!phone.trim() || phone.trim() === "+91") { toast.error("Phone number is required"); return; }
    if (!clinicId) { toast.error("Clinic not loaded. Please wait."); return; }
    const hasDup = await checkDuplicates();
    if (hasDup) return;
    await performSave();
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="grid gap-5 rounded-2xl border bg-card p-6 shadow-card">
      <h2 className="font-display text-xl font-semibold">
        {isEdit ? "Edit Patient" : "Add Patient"}
      </h2>
      <RestoreBanner
        visible={showRestoreBanner}
        onContinue={() => setShowRestoreBanner(false)}
        onDiscard={resetToInitial}
      />


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
          <Label htmlFor="convenientTime">Convenient Time to Call</Label>
          <Input id="convenientTime" value={convenientTime} onChange={(e) => setConvenientTime(e.target.value)} placeholder="e.g. Morning 9-11am" />
        </div>
        <div className="space-y-1.5">
          <Label>Lead Source</Label>
          <Select value={leadSource} onValueChange={setLeadSource}>
            <SelectTrigger><SelectValue placeholder="Select lead source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="Phone">Phone</SelectItem>
              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
              <SelectItem value="YuvaLife">YuvaLife</SelectItem>
              <SelectItem value="Friend">Friend</SelectItem>
            </SelectContent>
          </Select>
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
            <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Blood Group</Label>
          <Select value={bloodGroup} onValueChange={setBloodGroup}>
            <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
            <SelectContent>{BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
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
        <Textarea id="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
        <h3 className="font-display font-semibold">Lifestyle & Habits</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Food Habits</Label>
            <Select value={foodHabits} onValueChange={setFoodHabits}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vegetarian">Vegetarian</SelectItem>
                <SelectItem value="non_vegetarian">Non Vegetarian</SelectItem>
                <SelectItem value="vegan">Vegan</SelectItem>
                <SelectItem value="eggetarian">Eggetarian</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Smoking</Label>
            <Select value={smoking} onValueChange={setSmoking}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="non_smoker">Non Smoker</SelectItem>
                <SelectItem value="occasional">Occasional</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Alcohol</Label>
            <Select value={alcohol} onValueChange={setAlcohol}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None / Never</SelectItem>
                <SelectItem value="occasional">Occasional</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sleep">Sleep Hours / night</Label>
            <Input id="sleep" type="number" step="0.5" min="0" max="24" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dinner">Usual Dinner Time</Label>
            <Input id="dinner" type="time" value={dinnerTime} onChange={(e) => setDinnerTime(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
        <h3 className="font-display font-semibold">Medical History</h3>
        <div className="space-y-1.5">
          <Label htmlFor="allergies">Allergies (comma separated)</Label>
          <Input id="allergies" value={allergiesText} onChange={(e) => setAllergiesText(e.target.value)} placeholder="penicillin, dust" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="chronic">Chronic Conditions (comma separated)</Label>
          <Input id="chronic" value={chronicText} onChange={(e) => setChronicText(e.target.value)} placeholder="diabetes, hypertension" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meds">Current Medication</Label>
          <Textarea id="meds" rows={2} value={medicationHistory} onChange={(e) => setMedicationHistory(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="surgery">Past Surgery Details</Label>
          <Textarea id="surgery" rows={2} value={pastSurgery} onChange={(e) => setPastSurgery(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Add lead"}
        </Button>
      </div>
    </form>

    <Dialog open={duplicates.length > 0} onOpenChange={(o) => !o && setDuplicates([])}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" /> Possible duplicate
          </DialogTitle>
          <DialogDescription>
            A patient with this name or phone already exists. Continue anyway?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {duplicates.map((m) => (
            <div key={m.id} className="rounded-md border p-3 text-sm">
              <div className="font-semibold">{m.name}</div>
              <div className="text-muted-foreground">{m.phone}</div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDuplicates([])}>Cancel</Button>
          <Button onClick={() => { setDuplicates([]); performSave(); }} disabled={submitting}>Save anyway</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ---------- Lead List ----------
type LeadListProps = {
  clinicId: string;
  onEdit: (patient: Patient) => void;
  /** URL prefix for patient detail navigation. Defaults to /sales/patient. */
  patientHrefPrefix?: string;
  /** Initial status filter; defaults to "all". */
  defaultStatus?: LeadStatus | "all";
  /** Render a custom node when the search returns zero results (overrides default empty cell). */
  renderSearchEmpty?: (searchTerm: string) => React.ReactNode;
};

export function LeadList({ clinicId, onEdit, patientHrefPrefix = "/sales/patient", defaultStatus = "all", renderSearchEmpty }: LeadListProps) {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [notesByPatient, setNotesByPatient] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useUrlState("status", defaultStatus) as [
    LeadStatus | "all",
    (v: LeadStatus | "all") => void,
  ];
  const [sourceFilter, setSourceFilter] = useUrlState("source", "all");
  const [search, setSearch] = useUrlState("search", "");
  const [fromDate, setFromDate] = useUrlState("from", "");
  const [toDate, setToDate] = useUrlState("to", "");
  const [pageStr, setPageStr] = useUrlState("page", "1");
  const [pageSizeStr, setPageSizeStr] = useUrlState("per_page", "20");
  const page = Math.max(1, Number(pageStr) || 1);
  const pageSize = Math.max(1, Number(pageSizeStr) || 20);
  const setPage = (p: number | ((cur: number) => number)) => {
    const next = typeof p === "function" ? (p as any)(page) : p;
    setPageStr(String(next));
  };
  const setPageSize = (s: number) => setPageSizeStr(String(s));

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
      // Search overrides status filter so user can find any patient
      if (q) {
        const matches =
          p.name?.toLowerCase().includes(q) ||
          (p.phone ?? "").toLowerCase().includes(q) ||
          (p.email ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      } else {
        if (statusFilter !== "all" && p.lead_status !== statusFilter) return false;
      }
      if (sourceFilter !== "all" && p.lead_source !== sourceFilter) return false;
      if (fromDate && p.created_at && p.created_at < fromDate) return false;
      if (toDate && p.created_at && p.created_at > toDate + "T23:59:59") return false;
      return true;
    });
  }, [patients, statusFilter, sourceFilter, search, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [statusFilter, sourceFilter, search, fromDate, toDate, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportRows = () =>
    filtered.map((p) => ({
      Name: p.name,
      Phone: p.phone ?? "",
      Status: p.lead_status ?? "",
      "Lead Source": p.lead_source ?? "",
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
          <Label className="text-xs">Source</Label>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="Phone">Phone</SelectItem>
              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
              <SelectItem value="YuvaLife">YuvaLife</SelectItem>
              <SelectItem value="Friend">Friend</SelectItem>
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
              <TableHead>Lead Source</TableHead>
              <TableHead>Call Due</TableHead>
              <TableHead>SLA Breach</TableHead>
              <TableHead>Last Note</TableHead>
              <TableHead>Added On</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10">
                  {search.trim() && renderSearchEmpty
                    ? renderSearchEmpty(search.trim())
                    : <div className="text-center text-muted-foreground">No leads found</div>}
                </TableCell>
              </TableRow>
            ) : pageRows.map((p) => {
              const lastNote = notesByPatient[p.id];
              const breach = p.sla_breach_days ?? 0;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                  <button
                    type="button"
                    onClick={() => navigate(`${patientHrefPrefix}/${p.id}`)}
                    className="text-primary hover:underline font-medium"
                  >
                    {p.name}
                  </button>
                </TableCell>
                <TableCell className="text-sm">{p.phone ?? "—"}</TableCell>
                <TableCell>{statusBadge(p.lead_status)}</TableCell>
                <TableCell className="text-sm">{p.lead_source ?? "—"}</TableCell>
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

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Rows per page</Label>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[90px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground ml-2">
            {filtered.length === 0
              ? "0 results"
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length}`}
          </span>
        </div>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span className="px-2 py-1">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </div>
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
    if (!note.trim()) return;
    setBusy(true);
    try {
      await onAction(patient, outcome, note.trim());
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  const noteEmpty = note.trim().length === 0;

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
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
        {patient.convenient_time && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
            🕒 {patient.convenient_time}
          </span>
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
            <span title={noteEmpty ? "Add a note before logging the call" : undefined}>
              <Button size="sm" disabled={busy || noteEmpty}>
                Log Call <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem disabled={noteEmpty} onClick={() => handle("no_answer")}>
              <PhoneOff className="mr-2 h-4 w-4" /> No Answer
            </DropdownMenuItem>
            <DropdownMenuItem disabled={noteEmpty} onClick={() => handle("follow_up")}>
              <RotateCw className="mr-2 h-4 w-4" /> Follow Up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={noteEmpty} onClick={() => handle("not_interested")}>
              <XCircle className="mr-2 h-4 w-4" /> Not Interested
            </DropdownMenuItem>
            <DropdownMenuItem disabled={noteEmpty} onClick={() => handle("booked")}>
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

export function CallTask({ clinicId, onDoneClick, doneTodayOverride }: { clinicId: string; onDoneClick?: () => void; doneTodayOverride?: number }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [doneToday, setDoneToday] = useState(0);

  const load = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const today = todayISO();
      const [patientsRes, callsRes] = await Promise.all([
        supabase
          .from("patients")
          .select("*")
          .eq("clinic_id", clinicId)
          .in("lead_status", ["attempt1", "attempt2", "attempt3"])
          .lte("call_due_date", today),
        supabase
          .from("call_logs")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .gte("called_at", today + "T00:00:00")
          .lte("called_at", today + "T23:59:59"),
      ]);
      setRows(Array.isArray(patientsRes.data) ? (patientsRes.data as Patient[]) : []);
      setDoneToday(callsRes.count ?? 0);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load call tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const today = todayISO();
  const { overdue, dueToday } = useMemo(() => {
    const overdue: Patient[] = [];
    const dueToday: Patient[] = [];
    for (const p of rows) {
      const d = p.call_due_date;
      if (!d) continue;
      if (d < today) overdue.push(p);
      else if (d === today) dueToday.push(p);
    }
    overdue.sort((a, b) => (b.sla_breach_days ?? 0) - (a.sla_breach_days ?? 0));
    dueToday.sort((a, b) => (b.lead_status ?? "").localeCompare(a.lead_status ?? ""));
    return { overdue, dueToday };
  }, [rows, today]);

  const handleAction = async (p: Patient, outcome: CallOutcome, note: string) => {
    if (!profile?.id || !p?.clinic_id) {
      toast.error("Session not ready. Please refresh and try again.");
      return;
    }
    const current = (p.lead_status ?? "attempt1") as LeadStatus;
    let nextStatus: LeadStatus = current;
    let nextDue: string | null = p.call_due_date;
    let nextBreach: number = p.sla_breach_days ?? 0;
    let removeFromQueue = false;
    let navigateAfter: string | null = null;

    if (outcome === "no_answer") {
      if (current === "attempt1") {
        nextStatus = "attempt2";
        nextDue = addDaysISO(1);
        nextBreach = 0;
      } else if (current === "attempt2") {
        nextStatus = "attempt3";
        nextDue = addDaysISO(1);
        nextBreach = 0;
      } else {
        // attempt3 → auto close
        nextStatus = "closed";
        removeFromQueue = true;
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

    try {
      const { error: logError } = await supabase.from("call_logs").insert({
        patient_id: p.id,
        clinic_id: p.clinic_id,
        outcome,
        notes: note || null,
        called_by: profile.id,
        called_at: new Date().toISOString(),
      });
      if (logError) {
        toast.error(logError.message);
        return;
      }

      if (note) {
        const { error: noteError } = await supabase.from("contact_notes").insert({
          patient_id: p.id,
          clinic_id: p.clinic_id,
          note,
          created_by: profile.id,
        });
        if (noteError) {
          toast.error(noteError.message);
          return;
        }
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
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to log call");
      return;
    }

    toast.success(
      outcome === "no_answer"
        ? current === "attempt3"
          ? "Lead auto-closed after 3 no-answer attempts"
          : "Logged: No answer — moved to next attempt"
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
      // If next due is in the future, it leaves the queue (overdue/today only)
      const stillInQueue = nextDue && nextDue <= todayISO();
      if (!stillInQueue) {
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
        <button type="button" onClick={onDoneClick} className={cn(!onDoneClick && "pointer-events-none")}>
          <Pill icon="✅" label="Done Today" count={doneTodayOverride ?? doneToday} cls={cn("bg-green-50 text-green-700 border-green-200", onDoneClick && "cursor-pointer hover:bg-green-100")} />
        </button>
      </div>

      <CallSection title="Overdue" color="red" rows={overdue} onAction={handleAction} />
      <CallSection title="Due Today" color="yellow" rows={dueToday} onAction={handleAction} />
    </div>
  );
}

// ---------- Page ----------
type SalesSection = "leads" | "call-task" | "add-lead";

const SIDEBAR_ITEMS: { id: SalesSection; label: string; icon: typeof Users; path: string }[] = [
  { id: "leads", label: "Patient List", icon: Users, path: "/sales/leads" },
  { id: "call-task", label: "Call Task", icon: Phone, path: "/sales/call-task" },
  { id: "add-lead", label: "Add Patient", icon: UserPlus, path: "/sales/add-lead" },
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
    <SalesShell title={`Sales · ${sectionTitle}`}>
      {!clinicId ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Loading clinic...
        </div>
      ) : active === "leads" ? (
        <LeadList
          clinicId={clinicId}
          onEdit={(p) => {
            setEditing(p);
            navigate("/sales/add-lead");
          }}
        />
      ) : active === "call-task" ? (
        <CallTask clinicId={clinicId} />
      ) : (
        <div className="max-w-3xl">
          <LeadForm clinicId={clinicId} initial={editing} onSaved={handleSaved} />
        </div>
      )}
    </SalesShell>
  );
}

