import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const LEAD_COLUMNS: { key: string; label: string; dot: string }[] = [
  { key: "attempt1", label: "Attempt 1", dot: "bg-amber-500" },
  { key: "attempt2", label: "Attempt 2", dot: "bg-orange-500" },
  { key: "attempt3", label: "Attempt 3", dot: "bg-red-500" },
  { key: "lapsed", label: "Lapsed", dot: "bg-slate-400" },
  { key: "closed", label: "Closed", dot: "bg-slate-500" },
];

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  source: string | null;
  due: string | null;
  overdue_days: number;
};

export default function LeadPipelineBoard({ clinicId }: { clinicId: string | null }) {
  const [pipeline, setPipeline] = useState<Lead[]>([]);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await (supabase as any)
          .from("patients")
          .select("id, name, phone, lead_status, lead_source, call_due_date, created_at")
          .in("lead_status", ["attempt1", "attempt2", "attempt3", "closed", "lapsed"])
          .order("call_due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (cancelled) return;

        const rows: Lead[] = (data ?? [])
          .filter((p: any) => clinicId === null || p.clinic_id === clinicId)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            phone: p.phone,
            status: p.lead_status,
            source: p.lead_source,
            due: p.call_due_date,
            overdue_days:
              p.call_due_date && p.call_due_date < today
                ? new Date(today).getDate() - new Date(p.call_due_date).getDate()
                : 0,
          }));
        setPipeline(rows);
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || "Failed to load lead pipeline");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [clinicId]);

  const moveLead = async (leadId: string, toStatus: string) => {
    const lead = pipeline.find((p) => p.id === leadId);
    if (!lead || lead.status === toStatus) return;
    const isAttempt = toStatus.startsWith("attempt");
    const nextDue = isAttempt ? new Date(Date.now() + 86400_000).toISOString().slice(0, 10) : null;
    const prev = pipeline;
    setPipeline(prev.map((p) => (p.id === leadId ? { ...p, status: toStatus, due: nextDue, overdue_days: 0 } : p)));
    try {
      const { error } = await (supabase as any)
        .from("patients")
        .update({ lead_status: toStatus, call_due_date: nextDue, sla_breach_days: 0 })
        .eq("id", leadId);
      if (error) throw error;
      toast.success(
        `${lead.name} moved to ${LEAD_COLUMNS.find((c) => c.key === toStatus)?.label ?? toStatus}`,
      );
    } catch (e: any) {
      setPipeline(prev);
      toast.error(e?.message ?? "Failed to move lead");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Lead pipeline</CardTitle>
        <p className="text-xs text-muted-foreground">Drag a lead card between columns to change its stage</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="flex min-w-[720px] gap-3">
          {LEAD_COLUMNS.map((col) => {
            const items = pipeline.filter((p) => p.status === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) moveLead(id, col.key);
                }}
                className={`flex-1 rounded-lg border bg-muted/30 p-2 transition-colors ${
                  dragOverCol === col.key ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  {col.label}
                  <span className="ml-auto text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <p className="px-1 py-3 text-center text-[11px] text-muted-foreground">None</p>
                  )}
                  {items.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", p.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="rounded-md border bg-background p-2 text-xs hover:bg-muted active:cursor-grabbing cursor-grab"
                    >
                      <Link to={`/patients/${p.id}`} className="block">
                        <p className="truncate font-medium">{p.name}</p>
                        {p.phone && <p className="truncate text-muted-foreground">{p.phone}</p>}
                        {p.overdue_days > 0 ? (
                          <p className="mt-1 text-[11px] font-medium text-destructive">
                            Overdue {p.overdue_days}d
                          </p>
                        ) : p.due ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">Due {p.due}</p>
                        ) : null}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
