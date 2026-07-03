import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Search } from "lucide-react";
import { format } from "date-fns";

type Patient = { id: string; first_name: string | null; last_name: string | null; name: string | null; phone: string | null };
type Service = { id: string; name: string; amount: number; service_type: string | null };
type PlanItem = { service_id: string; service_name: string; total_sessions: number; sessions_per_visit: number; amount_per_session: number };

export default function TreatmentSchedule() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const { enabled, loading: flagLoading } = useTreatmentEnabled();
  const [params] = useSearchParams();
  const initialPatientId = params.get("patient_id");

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [addServiceId, setAddServiceId] = useState<string>("");
  const [addSessions, setAddSessions] = useState<number>(10);
  const [addPerVisit, setAddPerVisit] = useState<number>(1);
  const [planName, setPlanName] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    supabase
      .from("invoice_services")
      .select("id, name, amount, service_type")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .eq("service_type", "treatment")
      .order("name")
      .then(({ data }) => setServices((data as any) ?? []));
  }, [clinicId]);

  useEffect(() => {
    if (!initialPatientId || !clinicId) return;
    supabase.from("patients").select("id, first_name, last_name, name, phone").eq("id", initialPatientId).single()
      .then(({ data }) => data && setPatient(data as any));
  }, [initialPatientId, clinicId]);

  const doSearch = useCallback(async () => {
    if (!clinicId || !search.trim()) { setResults([]); return; }
    const term = `%${search.trim()}%`;
    const { data } = await supabase
      .from("patients")
      .select("id, first_name, last_name, name, phone")
      .eq("clinic_id", clinicId)
      .or(`name.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term}`)
      .limit(10);
    setResults((data as any) ?? []);
  }, [clinicId, search]);

  const addItem = () => {
    if (!addServiceId) return toast.error("Pick a service");
    const svc = services.find((s) => s.id === addServiceId);
    if (!svc) return;
    if (items.some((i) => i.service_id === svc.id)) return toast.error("Already added");
    setItems([...items, {
      service_id: svc.id,
      service_name: svc.name,
      total_sessions: addSessions,
      sessions_per_visit: addPerVisit,
      amount_per_session: Number(svc.amount),
    }]);
    setAddServiceId("");
    setAddSessions(10);
    setAddPerVisit(1);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.total_sessions * i.amount_per_session, 0),
    [items]
  );

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
    }));
    const { error: itemsErr } = await supabase.from("treatment_plan_items").insert(rows);
    if (itemsErr) { setSaving(false); return toast.error(itemsErr.message); }

    const { data: created, error: schedErr } = await (supabase as any).rpc("schedule_plan_sessions", {
      p_plan_id: plan.id,
      p_date: startDate,
    });
    setSaving(false);
    if (schedErr) return toast.error(`Plan saved but scheduling failed: ${schedErr.message}`);
    toast.success(`Treatment plan created — ${created ?? 0} session(s) scheduled for ${startDate}`);
    setItems([]);
    setPlanName("");
  };

  if (flagLoading) return <DashboardLayout title="Schedule Therapy"><div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div></DashboardLayout>;
  if (!enabled) return <Navigate to="/dashboard" replace />;

  const patientName = patient?.name || `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim();

  return (
    <DashboardLayout title="Schedule Therapy">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
        <Card className="shadow-card">
          <CardContent className="p-5 space-y-3">
            <Label>Patient</Label>
            {patient ? (
              <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                <div>
                  <div className="font-medium">{patientName}</div>
                  <div className="text-xs text-muted-foreground">{patient.phone ?? "—"}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setPatient(null); setResults([]); }}>Change</Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input placeholder="Search patient by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} />
                  <Button variant="outline" onClick={doSearch}><Search className="h-4 w-4" /></Button>
                </div>
                {results.length > 0 && (
                  <ul className="rounded-lg border divide-y">
                    {results.map((r) => {
                      const nm = r.name || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
                      return (
                        <li key={r.id}>
                          <button className="w-full px-3 py-2 text-left hover:bg-muted text-sm" onClick={() => { setPatient(r); setResults([]); }}>
                            <div className="font-medium">{nm}</div>
                            <div className="text-xs text-muted-foreground">{r.phone ?? "—"}</div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {patient && (
          <>
            <Card className="shadow-card">
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Plan Name</Label><Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Back pain 30 days" /></div>
                  <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                </div>

                <div className="rounded-lg border p-3 space-y-2">
                  <Label className="text-xs">Add therapy</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Select value={addServiceId} onValueChange={setAddServiceId}>
                      <SelectTrigger className="col-span-2"><SelectValue placeholder="Service" /></SelectTrigger>
                      <SelectContent>
                        {services.length === 0 && <div className="p-2 text-xs text-muted-foreground">No treatment services defined. Add them in Settings → Billing.</div>}
                        {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · ₹{s.amount}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min={1} value={addSessions} onChange={(e) => setAddSessions(Number(e.target.value))} placeholder="Total" />
                    <Input type="number" min={1} value={addPerVisit} onChange={(e) => setAddPerVisit(Number(e.target.value))} placeholder="Per visit" />
                  </div>
                  <Button size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Add</Button>
                </div>

                {items.length > 0 && (
                  <div className="rounded-lg border divide-y">
                    {items.map((i, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 text-sm">
                        <div>
                          <div className="font-medium">{i.service_name}</div>
                          <div className="text-xs text-muted-foreground">{i.total_sessions} sessions · {i.sessions_per_visit}/visit · ₹{i.amount_per_session}/session</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs">₹{(i.total_sessions * i.amount_per_session).toLocaleString("en-IN")}</span>
                          <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between p-3 text-sm font-semibold">
                      <span>Total plan value</span><span>₹{total.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={savePlan} disabled={saving || items.length === 0}>
                {saving ? "Saving…" : "Save Treatment Plan"}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
