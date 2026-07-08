import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ChevronDown, ChevronRight, CalendarPlus } from "lucide-react";
import { format } from "date-fns";

type Item = {
  id: string;
  service_name: string;
  total_sessions: number;
  sessions_completed: number | null;
  sessions_scheduled: number | null;
  sessions_per_visit: number;
  amount_per_session: number | null;
  status: string | null;
};
type Plan = {
  id: string;
  plan_name: string | null;
  start_date: string | null;
  status: string | null;
  total_plan_value: number | null;
  created_at: string | null;
  items: Item[];
};

// Combined progress bar showing completed (solid) + scheduled (light) segments.
function ProgressSegmented({ completed, scheduled, total, height = "h-1.5" }: { completed: number; scheduled: number; total: number; height?: string }) {
  const t = Math.max(total, 1);
  const compPct = Math.min(100, Math.round((completed / t) * 100));
  const schedPct = Math.min(100 - compPct, Math.round((scheduled / t) * 100));
  return (
    <div className={`w-full ${height} rounded-full bg-muted overflow-hidden flex`}>
      <div className="h-full bg-primary" style={{ width: `${compPct}%` }} />
      <div className="h-full bg-primary/30" style={{ width: `${schedPct}%` }} />
    </div>
  );
}

export default function PatientTreatmentTab({ patientId, clinicId }: { patientId: string; clinicId: string }) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const load = async () => {
    const { data } = await supabase
      .from("treatment_plans")
      .select("id, plan_name, start_date, status, total_plan_value, created_at, treatment_plan_items(id, service_name, total_sessions, sessions_completed, sessions_scheduled, sessions_per_visit, amount_per_session, status)")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    const mapped: Plan[] = (data ?? [])
      .map((p: any) => ({
        id: p.id,
        plan_name: p.plan_name,
        start_date: p.start_date,
        status: p.status,
        total_plan_value: p.total_plan_value,
        created_at: p.created_at,
        items: (p.treatment_plan_items ?? []).filter((i: any) => Number(i.total_sessions ?? 0) > 0),
      }))
      .filter((p: Plan) => p.items.length > 0);
    setPlans(mapped);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`patient-treatment-${patientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "treatment_plans", filter: `patient_id=eq.${patientId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "treatment_plan_items" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "therapy_sessions", filter: `patient_id=eq.${patientId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, clinicId]);

  const toggle = (id: string) => {
    const s = new Set(openIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setOpenIds(s);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Treatment Plans</h2>
          <p className="text-xs text-muted-foreground">{plans.length} plan{plans.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" onClick={() => navigate(`/treatment/schedule?patient_id=${patientId}`)}>
          <Plus className="h-4 w-4 mr-1" /> New Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card className="shadow-card"><CardContent className="py-12 text-center text-muted-foreground text-sm">No treatment plans yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => {
            const done = p.items.reduce((s, i) => s + (i.sessions_completed ?? 0), 0);
            const scheduled = p.items.reduce((s, i) => s + (i.sessions_scheduled ?? 0), 0);
            const total = p.items.reduce((s, i) => s + i.total_sessions, 0);
            const pct = total ? Math.round((done / total) * 100) : 0;
            const isOpen = openIds.has(p.id);
            return (
              <Card key={p.id} className="shadow-card">
                <CardContent className="p-4">
                  <button className="w-full text-left" onClick={() => toggle(p.id)}>
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.plan_name || "Treatment plan"}</span>
                          <Badge variant="outline" className="text-[10px]">{p.status ?? "active"}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Started {p.start_date ? format(new Date(p.start_date), "d MMM yyyy") : "—"} · ₹{Number(p.total_plan_value ?? 0).toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium">
                          {done}
                          {scheduled > 0 && <span className="text-primary/70"> +{scheduled}</span>}
                          /{total}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{pct}% done</div>
                      </div>
                    </div>
                    <div className="mt-3"><ProgressSegmented completed={done} scheduled={scheduled} total={total} /></div>
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-2 border-t pt-3">
                      {p.items.map((i) => {
                        const itemDone = i.sessions_completed ?? 0;
                        const itemSched = i.sessions_scheduled ?? 0;
                        return (
                          <div key={i.id} className="flex items-center justify-between text-sm">
                            <div className="flex-1">
                              <div className="font-medium">{i.service_name}</div>
                              <div className="mt-1"><ProgressSegmented completed={itemDone} scheduled={itemSched} total={i.total_sessions} height="h-1" /></div>
                            </div>
                            <div className="ml-3 text-xs text-muted-foreground">
                              {itemDone}
                              {itemSched > 0 && <span className="text-primary/70"> +{itemSched}</span>}
                              /{i.total_sessions}
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex justify-end pt-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/treatment/board`)}>
                          <CalendarPlus className="h-3 w-3 mr-1" /> Open board
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
