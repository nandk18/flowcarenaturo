import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Plus, ChevronDown, ChevronRight, CalendarPlus } from "lucide-react";
import { format } from "date-fns";

type Item = {
  id: string;
  service_name: string;
  total_sessions: number;
  sessions_completed: number | null;
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

export default function PatientTreatmentTab({ patientId, clinicId }: { patientId: string; clinicId: string }) {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("treatment_plans")
        .select("id, plan_name, start_date, status, total_plan_value, created_at, treatment_plan_items(id, service_name, total_sessions, sessions_completed, sessions_per_visit, amount_per_session, status)")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const mapped: Plan[] = (data ?? []).map((p: any) => ({
        id: p.id,
        plan_name: p.plan_name,
        start_date: p.start_date,
        status: p.status,
        total_plan_value: p.total_plan_value,
        created_at: p.created_at,
        items: p.treatment_plan_items ?? [],
      }));
      setPlans(mapped);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
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
                        <div className="text-xs font-medium">{done}/{total}</div>
                        <div className="text-[10px] text-muted-foreground">{pct}%</div>
                      </div>
                    </div>
                    <Progress value={pct} className="mt-3 h-1.5" />
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-2 border-t pt-3">
                      {p.items.map((i) => {
                        const itemDone = i.sessions_completed ?? 0;
                        const itemPct = i.total_sessions ? Math.round((itemDone / i.total_sessions) * 100) : 0;
                        return (
                          <div key={i.id} className="flex items-center justify-between text-sm">
                            <div className="flex-1">
                              <div className="font-medium">{i.service_name}</div>
                              <Progress value={itemPct} className="mt-1 h-1" />
                            </div>
                            <div className="ml-3 text-xs text-muted-foreground">{itemDone}/{i.total_sessions}</div>
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
