import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Play, CheckCircle2, Loader2, AlertTriangle, Plus, X, Camera, Search, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";
import { format } from "date-fns";
import { toast } from "sonner";

type Session = {
  id: string;
  patient_id: string;
  service_id: string | null;
  service_name: string;
  status: string;
  session_date: string;
  therapist_id: string | null;
  room: string | null;
  started_at: string | null;
  completed_at: string | null;
  session_number: number | null;
  setup_photo_url?: string | null;
  patients?: { id: string; first_name: string | null; last_name: string | null; name: string | null } | null;
  profiles?: { full_name: string | null; therapist_color: string | null } | null;
  treatment_plan_items?: { total_sessions: number | null } | null;
};

type Capacity = { service_id: string; service_name: string; max_per_day: number | null; booked_count: number; available: number; is_full: boolean; pct_full: number };
type Idle = { patient_id: string; patient_name: string; idle_minutes: number };
type Therapist = { id: string; full_name: string; therapist_color: string | null; room: string | null };
type SvcRow = { id: string; name: string; amount: number; duration_minutes: number | null };

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-sm text-muted-foreground">{format(now, "hh:mm:ss a")}</span>;
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const start = new Date(startedAt).getTime();
  const s = Math.max(0, Math.floor((now - start) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return <span className="font-mono text-sm text-orange-700">{mm}:{ss}</span>;
}

export default function TreatmentBoard() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const { enabled, loading: flagLoading } = useTreatmentEnabled();
  const today = format(new Date(), "yyyy-MM-dd");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [capacities, setCapacities] = useState<Capacity[]>([]);
  const [idle, setIdle] = useState<Idle[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [services, setServices] = useState<SvcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [capOpen, setCapOpen] = useState(true);

  const [futureSessions, setFutureSessions] = useState<{ id: string; session_date: string; service_name: string; patient_id: string }[]>([]);
  const [showFuture, setShowFuture] = useState(false);

  const refreshIdle = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.rpc("get_idle_patients", { p_clinic_id: clinicId });
    setIdle((data as any) ?? []);
  }, [clinicId]);

  const load = useCallback(async () => {
    if (!clinicId) return;
    const [s, c, i, f] = await Promise.all([
      supabase
        .from("therapy_sessions")
        .select(
          "id, patient_id, service_id, service_name, status, session_date, therapist_id, room, started_at, completed_at, session_number, setup_photo_url, patients(id, first_name, last_name, name), profiles:therapist_id(full_name, therapist_color), treatment_plan_items(total_sessions)"
        )
        .eq("clinic_id", clinicId)
        .eq("session_date", today)
        .order("started_at", { ascending: true, nullsFirst: false })
        .order("service_name"),
      supabase.rpc("get_all_capacities", { p_clinic_id: clinicId, p_date: today }),
      supabase.rpc("get_idle_patients", { p_clinic_id: clinicId }),
      supabase
        .from("therapy_sessions")
        .select("id, session_date, service_name, patient_id")
        .eq("clinic_id", clinicId)
        .gt("session_date", today)
        .eq("status", "not_started"),
    ]);
    setSessions((s.data as any) ?? []);
    setCapacities((c.data as any) ?? []);
    setIdle((i.data as any) ?? []);
    setFutureSessions((f.data as any) ?? []);
    setLoading(false);
  }, [clinicId, today]);

  useEffect(() => { load(); }, [load]);

  // Refresh idle every 60s
  useEffect(() => {
    if (!clinicId) return;
    const t = setInterval(() => { refreshIdle(); }, 60_000);
    return () => clearInterval(t);
  }, [clinicId, refreshIdle]);

  useEffect(() => {
    if (!clinicId) return;
    (supabase as any).rpc("list_clinic_therapists", { p_clinic_id: clinicId })
      .then(({ data }: any) => setTherapists((data as Therapist[]) ?? []));
    supabase
      .from("invoice_services")
      .select("id, name, amount, duration_minutes")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .eq("service_type", "treatment")
      .order("name")
      .then(({ data }) => setServices((data as any) ?? []));
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    const channel = supabase
      .channel("treatment-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "therapy_sessions", filter: `clinic_id=eq.${clinicId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "patient_idle_log", filter: `clinic_id=eq.${clinicId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinicId, load]);

  const startSession = async (s: Session, therapistId: string | null) => {
    setBusyId(s.id);
    const other = sessions.find(
      (x) => x.patient_id === s.patient_id && x.id !== s.id && x.status === "in_progress",
    );
    if (other) {
      setBusyId(null);
      toast.error(`Patient already has an ongoing session (${other.service_name}). Complete it first.`);
      return;
    }
    const t = therapists.find((x) => x.id === therapistId);
    const { error } = await supabase
      .from("therapy_sessions")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        therapist_id: therapistId ?? s.therapist_id,
        room: s.room ?? t?.room ?? null,
      })
      .eq("id", s.id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else {
      // Optimistically remove patient from idle alert
      setIdle((prev) => prev.filter((p) => p.patient_id !== s.patient_id));
      toast.success(`Started ${s.service_name}`);
    }
  };

  const completeSession = async (s: Session) => {
    setBusyId(s.id);
    const { error } = await supabase.rpc("complete_therapy_session", { p_session_id: s.id, p_notes: null });
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success(`Completed ${s.service_name}`);
  };

  const cancelSession = async (s: Session) => {
    if (!confirm(`Cancel ${s.service_name}?`)) return;
    setBusyId(s.id);
    const { error } = await supabase.from("therapy_sessions").update({ status: "cancelled" }).eq("id", s.id);
    setBusyId(null);
    if (error) toast.error(error.message);
  };

  const addTherapyForPatient = async (patientId: string, svc: SvcRow) => {
    if (!clinicId) return;
    const { error } = await supabase.from("therapy_sessions").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      service_id: svc.id,
      service_name: svc.name,
      session_date: today,
      status: "not_started",
      amount: svc.amount,
    });
    if (error) toast.error(error.message);
    else toast.success(`Added ${svc.name}`);
  };

  const summary = useMemo(() => {
    const ns: Session[] = [], ip: Session[] = [], cp: Session[] = [];
    for (const s of sessions) {
      if (s.status === "not_started") ns.push(s);
      else if (s.status === "in_progress") ip.push(s);
      else if (s.status === "completed") cp.push(s);
    }
    return { ns, ip, cp };
  }, [sessions]);

  const patientNameOf = (s: Session) =>
    s.patients?.name || `${s.patients?.first_name ?? ""} ${s.patients?.last_name ?? ""}`.trim() || "Patient";

  const grouped = useMemo(() => {
    const byPatient = new Map<string, Session[]>();
    for (const s of sessions) {
      const arr = byPatient.get(s.patient_id) ?? [];
      arr.push(s);
      byPatient.set(s.patient_id, arr);
    }
    const rank = (s: Session) => (s.status === "in_progress" ? 0 : s.status === "not_started" ? 1 : 2);
    const entries = Array.from(byPatient.entries());
    entries.sort((a, b) => {
      const ra = Math.min(...a[1].map(rank));
      const rb = Math.min(...b[1].map(rank));
      return ra - rb;
    });
    return entries;
  }, [sessions]);

  if (flagLoading) return <DashboardLayout title="Treatment Board"><div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div></DashboardLayout>;
  if (!enabled) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout title="Treatment Board">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 space-y-4">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold">Treatment Board — Today</h1>
            <div className="flex items-center gap-3 mt-1">
              <LiveClock />
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Not started</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> In progress</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard tone="red" label="Not Started" count={summary.ns.length} names={summary.ns.map(patientNameOf)} />
          <StatCard tone="orange" label="In Progress" count={summary.ip.length} names={summary.ip.map(patientNameOf)} />
          <StatCard tone="green" label="Completed" count={summary.cp.length} names={summary.cp.map(patientNameOf)} />
        </div>

        {/* Idle banner */}
        {idle.length > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium text-sm">{idle.length} patient{idle.length > 1 ? "s" : ""} idle &gt; 20 min</span>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-amber-800">
              {idle.map((i) => <li key={i.patient_id}>• {i.patient_name} — idle {i.idle_minutes} min</li>)}
            </ul>
          </div>
        )}

        {/* Future sessions cleanup banner */}
        {futureSessions.length > 0 && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">
                  ⚠️ {futureSessions.length} session{futureSessions.length > 1 ? "s" : ""} scheduled for future dates. These were created in error.
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowFuture((v) => !v)}>
                {showFuture ? "Hide" : "Review & Clean Up"}
              </Button>
            </div>
            {showFuture && (
              <div className="rounded-lg border bg-background p-2 space-y-2">
                <ul className="max-h-48 overflow-y-auto text-xs divide-y">
                  {futureSessions.map((f) => (
                    <li key={f.id} className="py-1 flex justify-between gap-2">
                      <span className="truncate">{f.service_name}</span>
                      <span className="text-muted-foreground font-mono">{f.session_date}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (!clinicId) return;
                    if (!confirm(`Delete ${futureSessions.length} future session(s)?`)) return;
                    const { error } = await supabase
                      .from("therapy_sessions")
                      .delete()
                      .eq("clinic_id", clinicId)
                      .gt("session_date", today)
                      .eq("status", "not_started");
                    if (error) toast.error(error.message);
                    else {
                      toast.success("Future sessions removed");
                      setShowFuture(false);
                      load();
                    }
                  }}
                >
                  Delete All Future Sessions
                </Button>
              </div>
            )}
          </div>
        )}




        {/* Patient cards */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : grouped.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-16 text-center text-muted-foreground">
              No therapy sessions scheduled for today.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {grouped.map(([patientId, list]) => {
              const name = patientNameOf(list[0]);
              const done = list.filter((s) => s.status === "completed").length;
              const allDone = done === list.length;
              return (
                <Card key={patientId} className={`shadow-card ${allDone ? "opacity-80" : ""}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                          {name.charAt(0)}
                        </div>
                        <div className="font-display font-semibold truncate">{name}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{done}/{list.length}</Badge>
                    </div>
                    <ul className="space-y-2">
                      {list.map((s) => (
                        <SessionRow
                          key={s.id}
                          s={s}
                          busy={busyId === s.id}
                          therapists={therapists}
                          onStart={(tid) => startSession(s, tid)}
                          onComplete={() => completeSession(s)}
                          onCancel={() => cancelSession(s)}
                        />
                      ))}
                    </ul>
                    <AddTherapyForPatient
                      services={services}
                      onPick={(svc) => addTherapyForPatient(patientId, svc)}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ tone, label, count, names }: { tone: "red" | "orange" | "green"; label: string; count: number; names: string[] }) {
  const tones = {
    red: "bg-red-500/10 border-red-500/30 text-red-700",
    orange: "bg-orange-500/10 border-orange-500/30 text-orange-700",
    green: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${tones}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold">{count}</div>
      <div className="mt-1 text-[11px] line-clamp-2 opacity-80">
        {names.length === 0 ? "—" : Array.from(new Set(names)).join(", ")}
      </div>
    </div>
  );
}

function SessionRow({
  s, busy, therapists, onStart, onComplete, onCancel,
}: {
  s: Session; busy: boolean; therapists: Therapist[];
  onStart: (therapistId: string | null) => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const total = s.treatment_plan_items?.total_sessions ?? null;
  const sessLabel = s.session_number ? `Session ${s.session_number}${total ? ` of ${total}` : ""}` : "";
  if (s.status === "not_started") {
    return (
      <li className="rounded-lg border border-l-4 border-red-500/60 bg-red-500/5 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase text-red-700">Not started</div>
            <div className="text-sm font-medium truncate">{s.service_name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {sessLabel && `${sessLabel} · `}{s.profiles?.full_name ?? "Unassigned"}{s.room ? ` · ${s.room}` : ""}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" disabled={busy}><Play className="h-3 w-3 mr-1" />Start</Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2">
                <div className="text-xs text-muted-foreground mb-1 px-2">Assign to:</div>
                <div className="grid gap-1">
                  {therapists.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onStart(t.id)}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.therapist_color ?? "hsl(var(--primary))" }} />
                      {t.full_name}
                    </button>
                  ))}
                  <button onClick={() => onStart(null)} className="mt-1 rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted">
                    Start unassigned
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel} title="Cancel"><X className="h-3 w-3" /></Button>
          </div>
        </div>
      </li>
    );
  }
  if (s.status === "in_progress") {
    return (
      <li className="rounded-lg border border-l-4 border-orange-500/60 bg-orange-500/5 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase text-orange-700">In progress</div>
            <div className="text-sm font-medium truncate">{s.service_name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {s.profiles?.full_name ?? "Unassigned"}{s.room ? ` · ${s.room}` : ""}{sessLabel && ` · ${sessLabel}`}
            </div>
            {s.started_at && <div className="mt-0.5"><ElapsedTimer startedAt={s.started_at} /></div>}
          </div>
          <div className="flex flex-col gap-1">
            <Button size="sm" disabled={busy} onClick={onComplete}><CheckCircle2 className="h-3 w-3 mr-1" />Complete</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}><X className="h-3 w-3" /></Button>
          </div>
        </div>
      </li>
    );
  }
  if (s.status === "completed") {
    const dur = s.started_at && s.completed_at
      ? Math.max(0, Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000))
      : null;
    return (
      <li className="rounded-lg border border-l-4 border-emerald-500/60 bg-emerald-500/5 p-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase text-emerald-700">Completed</div>
            <div className="text-sm font-medium truncate">{s.service_name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {s.profiles?.full_name ?? "Unassigned"}{s.room ? ` · ${s.room}` : ""}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {s.started_at && format(new Date(s.started_at), "h:mm a")}
              {s.completed_at && ` → ${format(new Date(s.completed_at), "h:mm a")}`}
              {dur !== null && ` · ${dur} min`}
              {sessLabel && ` · ${sessLabel} ✓`}
            </div>
            {s.setup_photo_url && (
              <a href={s.setup_photo_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary underline">
                <Camera className="h-3 w-3" /> View photo
              </a>
            )}
          </div>
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        </div>
      </li>
    );
  }
  return null;
}

function AddTherapyForPatient({ services, onPick }: { services: SvcRow[]; onPick: (s: SvcRow) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return services.slice(0, 6);
    return services.filter((s) => s.name.toLowerCase().includes(term)).slice(0, 8);
  }, [q, services]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
          <Plus className="h-3 w-3 mr-1" /> Add therapy for this patient
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services…" className="pl-7 h-8 text-sm" autoFocus />
        </div>
        <ul className="max-h-64 overflow-y-auto divide-y">
          {matches.map((s) => (
            <li key={s.id}>
              <button
                className="w-full px-2 py-1.5 text-left hover:bg-muted rounded text-sm"
                onClick={() => { onPick(s); setOpen(false); setQ(""); }}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {s.duration_minutes ? `${s.duration_minutes} min · ` : ""}₹{Number(s.amount).toLocaleString("en-IN")}
                </div>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="p-2 text-xs text-muted-foreground">No matches</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
