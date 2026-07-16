import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";


type Item = {
  id: string;
  title: string;
  order_index: number | null;
};

type Log = {
  checklist_item_id: string;
  is_checked: boolean | null;
  checked_at: string | null;
  checked_by: string | null;
  checker_name?: string | null;
};

export default function ChecklistPage({
  type,
  title,
  defaults: _defaults,
}: {
  type: "opening" | "closing";
  title: string;
  defaults?: string[];
}) {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const today = format(new Date(), "yyyy-MM-dd");
  const [items, setItems] = useState<Item[]>([]);
  const [logs, setLogs] = useState<Record<string, Log>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data: itemRows } = await supabase
      .from("checklist_items")
      .select("id, title, order_index")
      .eq("clinic_id", clinicId)
      .eq("type", type)
      .eq("is_active", true)
      .order("order_index", { ascending: true });
    const its = (itemRows ?? []) as Item[];
    setItems(its);

    if (its.length) {
      const { data: logRows } = await supabase
        .from("checklist_logs")
        .select("checklist_item_id, is_checked, checked_at, checked_by")
        .eq("clinic_id", clinicId)
        .eq("check_date", today)
        .in("checklist_item_id", its.map((i) => i.id));

      const map: Record<string, Log> = {};
      (logRows ?? []).forEach((l: any) => { map[l.checklist_item_id] = l; });

      const ids = Array.from(new Set((logRows ?? []).map((l: any) => l.checked_by).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
        const pm = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
        Object.values(map).forEach((l) => {
          l.checker_name = l.checked_by ? pm.get(l.checked_by) ?? null : null;
        });
      }
      setLogs(map);
    } else {
      setLogs({});
    }
    setLoading(false);
  }, [clinicId, today, type]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (item: Item) => {
    if (!clinicId) return;
    const cur = logs[item.id];
    const next = !cur?.is_checked;
    const { data: { user } } = await supabase.auth.getUser();
    // checked_by FK -> auth.users(id), so use auth user id, not profiles.id
    const userId = user?.id ?? null;


    if (cur) {
      const { error } = await supabase
        .from("checklist_logs")
        .update({
          is_checked: next,
          checked_at: next ? new Date().toISOString() : null,
          checked_by: next ? userId : null,
        })
        .eq("checklist_item_id", item.id)
        .eq("check_date", today)
        .eq("clinic_id", clinicId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("checklist_logs").insert({
        clinic_id: clinicId,
        checklist_item_id: item.id,
        check_date: today,
        is_checked: next,
        checked_at: next ? new Date().toISOString() : null,
        checked_by: next ? userId : null,
      });
      if (error) { toast.error(error.message); return; }
    }
    load();
  };

  const done = items.filter((i) => logs[i.id]?.is_checked).length;

  return (
    <DashboardLayout title={title}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <h1 className="font-display text-xl font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE, dd MMM yyyy")}</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="font-medium">{done} / {items.length} completed</span>
            <span className="text-xs text-muted-foreground">{items.length ? Math.round((done / items.length) * 100) : 0}%</span>
          </div>
          <Progress value={items.length ? (done / items.length) * 100 : 0} className="h-2" />

          <ul className="mt-5 divide-y">
            {loading ? (
              <li className="py-6 text-center text-sm text-muted-foreground">Loading…</li>
            ) : items.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No checklist items configured. <Link to={`/settings/${type}-checklist`} className="text-primary hover:underline">Configure in Settings</Link>
              </li>
            ) : items.map((it) => {
              const log = logs[it.id];
              const checked = !!log?.is_checked;
              return (
                <li key={it.id} className="flex items-start gap-3 py-3">
                  <Checkbox checked={checked} onCheckedChange={() => toggle(it)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm", checked && "line-through text-muted-foreground")}>{it.title}</p>
                    {checked && log?.checked_at && (
                      <p className="text-[11px] text-green-700">
                        ✓ Checked by {log.checker_name ?? "—"} at {format(new Date(log.checked_at), "h:mm a")}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
