import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Search, User as UserIcon } from "lucide-react";
import { format } from "date-fns";

type Patient = { id: string; first_name: string | null; last_name: string | null; name: string | null; phone: string | null };
type Service = { id: string; name: string; amount: number; service_type: string | null; duration_minutes?: number | null; max_per_day?: number | null };
type PlanItem = {
  service_id: string;
  service_name: string;
  duration_minutes?: number | null;
  total_sessions: number;
  sessions_per_visit: number;
  amount_per_session: number;
  scheduleToday: boolean;
  notes?: string;
};

type Capacity = { service_id: string; service_name: string; max_per_day: number | null; booked_count: number; available: number; is_full: boolean; pct_full: number };

function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function TreatmentSchedule() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const { enabled, loading: flagLoading } = useTreatmentEnabled();
  const [params] = useSearchParams();
  const initialPatientId = params.get("patient_id");
  const navigate = useNavigate();

  // Patient search
  const [search, setSearch] = useState("");
  const debSearch = useDebounce(search, 300);
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);

  // Services + plan
  const [services, setServices] = useState<Service[]>([]);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [capacities, setCapacities] = useState<Capacity[]>([]);

  // Service search
  const [svcQuery, setSvcQuery] = useState("");
  const debSvcQuery = useDebounce(svcQuery, 200);
  const [pickedSvc, setPickedSvc] = useState<Service | null>(null);
  const [pTotal, setPTotal] = useState(6);
  const [pPer, setPPer] = useState(1);

  const [planName, setPlanName] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  // Load services + capacities once we have clinic
  useEffect(() => {
    if (!clinicId) return;
    supabase
      .from("invoice_services")
      .select("id, name, amount, service_type, duration_minutes, max_per_day")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .eq("service_type", "treatment")
      .order("name")
      .then(({ data }) => setServices((data as any) ?? []));
    supabase.rpc("get_all_capacities", { p_clinic_id: clinicId, p_date: startDate })
      .then(({ data }) => setCapacities((data as any) ?? []));
  }, [clinicId, startDate]);

  // Preselected patient
  useEffect(() => {
    if (!initialPatientId || !clinicId) return;
    supabase.from("patients").select("id, first_name, last_name, name, phone").eq("id", initialPatientId).maybeSingle()
      .then(({ data }) => data && setPatient(data as any));
  }, [initialPatientId, clinicId]);

  // Debounced patient search
  useEffect(() => {
    if (!clinicId || patient) { setResults([]); return; }
    const q = debSearch.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const term = `%${q}%`;
    supabase
      .from("patients")
      .select("id, first_name, last_name, name, phone")
      .eq("clinic_id", clinicId)
      .or(`name.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term}`)
      .limit(8)
      .then(({ data }) => { if (!cancelled) { setResults((data as any) ?? []); setSearching(false); } });
    return () => { cancelled = true; };
  }, [debSearch, clinicId, patient]);

  const svcMatches = useMemo(() => {
    const q = debSvcQuery.trim().toLowerCase();
    if (!q) return services.slice(0, 6);
    return services.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [services, debSvcQuery]);

  const addItem = () => {
    if (!pickedSvc) return;
    if (items.some((i) => i.service_id === pickedSvc.id)) { toast.error("Already added"); return; }
    setItems((prev) => [...prev, {
      service_id: pickedSvc.id,
      service_name: pickedSvc.name,
      duration_minutes: pickedSvc.duration_minutes ?? null,
      total_sessions: Math.max(1, pTotal),
      sessions_per_visit: Math.max(1, pPer),
      amount_per_session: Number(pickedSvc.amount),
      scheduleToday: true,
      notes: "",
    }]);

    setPickedSvc(null);
    setSvcQuery("");
    setPTotal(6);
    setPPer(1);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const toggleToday = (idx: number, v: boolean) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, scheduleToday: v } : it)));
  const updateNotes = (idx: number, v: string) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, notes: v } : it)));


  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.total_sessions * i.amount_per_session, 0),
    [items]
  );
  const visitsEstimate = useMemo(
    () => items.reduce((sum, i) => sum + Math.ceil(i.total_sessions / Math.max(1, i.sessions_per_visit)), 0),
    [items]
  );

  const capacityFor = (serviceId: string) => capacities.find((c) => c.service_id === serviceId);

  const savePlan = async () => {
    if (!clinicId || !patient) return toast.error("Select a patient");
    if (items.length === 0) return toast.error("Add at least one service");
    setSaving(true);

    const { data: plan, error: planErr } = await supabase
      .from("treatment_plans")
      .insert({
        clinic_id: clinicId,
        patient_id: patient.id,
        plan_name: planName || null,
        start_date: startDate,
        status: "active",
        total_plan_value: total,
        created_by: profile?.id,
      })
      .select("id")
      .single();
    if (planErr || !plan) { setSaving(false); return toast.error(planErr?.message ?? "Failed"); }

    const rows = items.map((i) => ({
      treatment_plan_id: plan.id,
      clinic_id: clinicId,
      service_id: i.service_id,
      service_name: i.service_name,
      total_sessions: i.total_sessions,
      sessions_per_visit: i.sessions_per_visit,
      amount_per_session: i.amount_per_session,
      sessions_completed: 0,
      sessions_scheduled: 0,
      status: "active",
      notes: i.notes?.trim() || null,
    }));

    const { data: createdItems, error: itemsErr } = await supabase
      .from("treatment_plan_items")
      .insert(rows)
      .select("id, service_id");
    if (itemsErr || !createdItems) { setSaving(false); return toast.error(itemsErr?.message ?? "Failed items"); }

    // Create ONE therapy_session per checked item for today only
    const todayItems = items
      .map((i) => ({ ...i, plan_item_id: (createdItems as any[]).find((c) => c.service_id === i.service_id)?.id }))
      .filter((i) => i.scheduleToday && i.plan_item_id);

    let scheduled = 0;
    if (todayItems.length > 0) {
      const sessionRows = todayItems.map((i) => ({
        clinic_id: clinicId,
        patient_id: patient.id,
        treatment_plan_id: plan.id,
        treatment_plan_item_id: i.plan_item_id,
        service_id: i.service_id,
        service_name: i.service_name,
        session_date: startDate,
        session_number: 1,
        status: "not_started",
        amount: i.amount_per_session,
        notes: i.notes?.trim() || null,
      }));
      const { error: sErr } = await supabase.from("therapy_sessions").insert(sessionRows);
      if (sErr) { setSaving(false); return toast.error(sErr.message); }

      scheduled = sessionRows.length;

      // bump sessions_scheduled on each item
      await Promise.all(
        todayItems.map((i) =>
          supabase.from("treatment_plan_items")
            .update({ sessions_scheduled: 1 })
            .eq("id", i.plan_item_id)
        )
      );
    }

    setSaving(false);
    toast.success(`Plan saved. ${scheduled} session(s) scheduled for today's board.`);
    navigate("/treatment/board");
  };

  if (flagLoading) return <DashboardLayout title="Schedule Therapy"><div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div></DashboardLayout>;
  if (!enabled) return <Navigate to="/dashboard" replace />;

  const patientName = patient?.name || `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim();
  const isToday = startDate === format(new Date(), "yyyy-MM-dd");

  return (
    <DashboardLayout title="Schedule Therapy">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
        {/* Patient */}
        <Card className="shadow-card">
          <CardContent className="p-5 space-y-3">
            <Label>Patient</Label>
            {patient ? (
              <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{patientName || "Patient"}</div>
                    <div className="text-xs text-muted-foreground">{patient.phone ?? "—"}</div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setPatient(null); setSearch(""); setResults([]); }}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    className="pl-9"
                    placeholder="Search patient by name or phone… (min 2 chars)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {results.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-lg border bg-popover shadow-lg divide-y max-h-80 overflow-y-auto">
                    {results.map((r) => {
                      const nm = r.name || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Patient";
                      return (
                        <li key={r.id}>
                          <button
                            className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                            onClick={() => { setPatient(r); setResults([]); setSearch(""); }}
                          >
                            <div className="font-medium">{nm}</div>
                            <div className="text-xs text-muted-foreground">{r.phone ?? "—"}</div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {debSearch.trim().length >= 2 && !searching && results.length === 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">No patients matched "{debSearch}".</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan meta + services (only after patient selected) */}
        {patient && (
          <>
            <Card className="shadow-card">
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Plan Name</Label>
                    <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Back pain 30 days" />
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                </div>

                {/* Add therapy search */}
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="text-sm font-medium">Add Therapy to Plan</div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search treatment services…"
                      value={svcQuery}
                      onChange={(e) => { setSvcQuery(e.target.value); setPickedSvc(null); }}
                    />
                  </div>

                  {!pickedSvc && svcMatches.length > 0 && (
                    <ul className="rounded-lg border divide-y bg-background">
                      {svcMatches.map((s) => (
                        <li key={s.id}>
                          <button
                            className="w-full px-3 py-2 text-left hover:bg-muted"
                            onClick={() => setPickedSvc(s)}
                          >
                            <div className="text-sm font-medium">{s.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {s.duration_minutes ? `${s.duration_minutes} min · ` : ""}₹{Number(s.amount).toLocaleString("en-IN")}/session
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!pickedSvc && debSvcQuery && svcMatches.length === 0 && (
                    <div className="text-xs text-muted-foreground">No treatment services match.</div>
                  )}

                  {pickedSvc && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">{pickedSvc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {pickedSvc.duration_minutes ? `${pickedSvc.duration_minutes} min · ` : ""}₹{Number(pickedSvc.amount).toLocaleString("en-IN")}/session
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setPickedSvc(null)}>Change</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Total Sessions in Plan</Label>
                          <Input type="number" min={1} value={pTotal} onChange={(e) => setPTotal(Number(e.target.value))} />
                        </div>
                        <div>
                          <Label className="text-xs">Sessions per visit</Label>
                          <Input type="number" min={1} value={pPer} onChange={(e) => setPPer(Number(e.target.value))} />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        → {pTotal} total sessions, {pPer} per visit = {Math.ceil(pTotal / Math.max(1, pPer))} visits needed<br />
                        → {isToday ? "Today" : startDate}: 1 session will be scheduled
                      </div>
                      <Button size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add to Plan</Button>
                    </div>
                  )}
                </div>

                {/* Plan items */}
                {items.length > 0 && (
                  <div className="rounded-lg border divide-y">
                    {items.map((i, idx) => (
                      <div key={idx} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span className="font-medium text-sm">{i.service_name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {i.duration_minutes ? `${i.duration_minutes} min · ` : ""}₹{i.amount_per_session.toLocaleString("en-IN")}/session
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {i.total_sessions} sessions · {i.sessions_per_visit}/visit
                            </div>
                            <div className="text-xs text-emerald-700 mt-0.5">
                              → Schedule 1 session {isToday ? "TODAY" : `on ${startDate}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono text-xs">₹{(i.total_sessions * i.amount_per_session).toLocaleString("en-IN")}</span>
                            <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between p-3 text-sm font-semibold">
                      <span>Plan total</span>
                      <span>₹{total.toLocaleString("en-IN")} · ~{visitsEstimate} visits</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* What to do TODAY */}
            {items.length > 0 && (
              <Card className="shadow-card">
                <CardContent className="p-5 space-y-3">
                  <div>
                    <div className="font-display font-semibold">What to do {isToday ? "TODAY" : `on ${startDate}`}?</div>
                    <div className="text-xs text-muted-foreground">Select which therapies to schedule for this visit</div>
                  </div>
                  <ul className="space-y-2">
                    {items.map((i, idx) => {
                      const cap = capacityFor(i.service_id);
                      const isFull = !!cap?.is_full;
                      const capLabel = cap?.max_per_day
                        ? isFull
                          ? `Capacity: ${cap.booked_count}/${cap.max_per_day} FULL`
                          : `Capacity: ${cap.available}/${cap.max_per_day} slots available`
                        : "Capacity: unlimited";
                      const capColor = isFull ? "text-destructive" : (cap?.pct_full ?? 0) > 75 ? "text-amber-600" : "text-emerald-600";
                      const disabled = isFull;
                      const checked = i.scheduleToday && !disabled;
                      return (
                        <li key={idx} className="flex items-start gap-3 rounded-lg border bg-background p-3">
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(v) => toggleToday(idx, Boolean(v))}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              {i.service_name} <span className="text-muted-foreground font-normal">(1 of {i.total_sessions} sessions)</span>
                            </div>
                            <div className={`text-xs ${capColor}`}>{capLabel}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={savePlan} disabled={saving || items.length === 0}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save Treatment Plan"}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
