import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play, CheckCircle2, Loader2, AlertTriangle, UserCheck, Send, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { useTreatmentEnabled } from "@/hooks/useTreatmentEnabled";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { openWhatsApp } from "@/lib/whatsapp";
import { buildMessage } from "@/lib/messageTemplates";

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
  patients?: { id: string; first_name: string | null; last_name: string | null; name: string | null } | null;
  profiles?: { full_name: string | null; therapist_color: string | null } | null;
};

type Capacity = {
  service_id: string;
  service_name: string;
  max_per_day: number | null;
  booked_count: number;
  available: number;
  is_full: boolean;
  pct_full: number;
};

type Idle = {
  patient_id: string;
  patient_name: string;
  idle_minutes: number;
};

export default function TreatmentBoard() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const { enabled, loading: flagLoading } = useTreatmentEnabled();
  const today = format(new Date(), "yyyy-MM-dd");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [capacities, setCapacities] = useState<Capacity[]>([]);
  const [idle, setIdle] = useState<Idle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) return;
    const [s, c, i] = await Promise.all([
      supabase
        .from("therapy_sessions")
        .select(
          "id, patient_id, service_id, service_name, status, session_date, therapist_id, room, started_at, completed_at, session_number, patients(id, first_name, last_name, name), profiles:therapist_id(full_name, therapist_color)"
        )
        .eq("clinic_id", clinicId)
        .eq("session_date", today)
        .order("service_name"),
      supabase.rpc("get_all_capacities", { p_clinic_id: clinicId, p_date: today }),
      supabase.rpc("get_idle_patients", { p_clinic_id: clinicId }),
    ]);
    setSessions((s.data as any) ?? []);
    setCapacities((c.data as any) ?? []);
    setIdle((i.data as any) ?? []);
    setLoading(false);
  }, [clinicId, today]);

  const backfillToday = useCallback(async () => {
    if (!clinicId) return 0;
    const { data: plans } = await supabase
      .from("treatment_plans")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .lte("start_date", today);
    if (!plans || plans.length === 0) return 0;
    let total = 0;
    for (const p of plans as any[]) {
      const { data } = await (supabase as any).rpc("schedule_plan_sessions", {
        p_plan_id: p.id,
        p_date: today,
      });
      total += Number(data ?? 0);
    }
    return total;
  }, [clinicId, today]);

  useEffect(() => {
    (async () => {
      await backfillToday();
      await load();
    })();
  }, [backfillToday, load]);

  useEffect(() => {
    if (!clinicId) return;
    const channel = supabase
      .channel("treatment-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "therapy_sessions", filter: `clinic_id=eq.${clinicId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "patient_idle_log", filter: `clinic_id=eq.${clinicId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinicId, load]);

  const grouped = useMemo(() => {
    const byPatient = new Map<string, Session[]>();
    for (const s of sessions) {
      const arr = byPatient.get(s.patient_id) ?? [];
      arr.push(s);
      byPatient.set(s.patient_id, arr);
    }
    return Array.from(byPatient.entries());
  }, [sessions]);

  const startSession = async (s: Session) => {
    setBusyId(s.id);
    const { error } = await supabase
      .from("therapy_sessions")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", s.id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success(`Started ${s.service_name}`);
  };

  const completeSession = async (s: Session) => {
    setBusyId(s.id);
    const { data, error } = await supabase.rpc("complete_therapy_session", { p_session_id: s.id, p_notes: null });
    setBusyId(null);
    if (error) toast.error(error.message);
    else toast.success(`Completed ${s.service_name}`);
  };

  if (flagLoading) return <DashboardLayout title="Treatment Board"><div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div></DashboardLayout>;
  if (!enabled) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout title="Treatment Board">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {/* Idle banner */}
        {idle.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium text-sm">{idle.length} patient{idle.length > 1 ? "s" : ""} idle &gt; 20 min</span>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-amber-800">
              {idle.map((i) => (
                <li key={i.patient_id}>• {i.patient_name} — idle {i.idle_minutes} min</li>
              ))}
            </ul>
          </div>
        )}

        {/* Capacity bar */}
        {capacities.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
            {capacities.map((c) => (
              <div key={c.service_id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">{c.service_name}</span>
                  <span className={`text-xs font-bold ${c.is_full ? "text-destructive" : "text-muted-foreground"}`}>
                    {c.booked_count}/{c.max_per_day ?? "∞"}
                  </span>
                </div>
                {c.max_per_day && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-muted">
                    <div
                      className={`h-full rounded ${c.is_full ? "bg-destructive" : c.pct_full > 75 ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, c.pct_full)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : grouped.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-16 text-center text-muted-foreground space-y-3">
              <div>No therapy sessions scheduled for today.</div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const n = await backfillToday();
                  await load();
                  if (n > 0) toast.success(`Scheduled ${n} session(s) for today`);
                  else toast.info("No active plans to schedule today");
                }}
              >
                Schedule today's sessions
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {grouped.map(([patientId, list]) => {
              const p = list[0].patients;
              const name = p?.name || `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "Patient";
              const allDone = list.every((s) => s.status === "completed");
              return (
                <Card key={patientId} className={`shadow-card ${allDone ? "opacity-70" : ""}`}>
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-display font-semibold">{name}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {list.filter((s) => s.status === "completed").length}/{list.length}
                      </Badge>
                    </div>
                    <ul className="space-y-2">
                      {list.map((s) => (
                        <li key={s.id} className="flex items-center justify-between rounded-lg border bg-background p-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{s.service_name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {s.profiles?.full_name ? `${s.profiles.full_name}` : "Unassigned"}
                              {s.room ? ` · ${s.room}` : ""}
                              {s.status === "in_progress" && " · in progress"}
                              {s.status === "completed" && " · done"}
                            </div>
                          </div>
                          {s.status === "not_started" && (
                            <Button size="sm" variant="outline" disabled={busyId === s.id} onClick={() => startSession(s)}>
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                          {s.status === "in_progress" && (
                            <Button size="sm" disabled={busyId === s.id} onClick={() => completeSession(s)}>
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                          )}
                          {s.status === "completed" && (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          )}
                        </li>
                      ))}
                    </ul>
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
