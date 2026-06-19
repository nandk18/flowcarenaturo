import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Trash2, RotateCcw, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  title: string;
  is_checked: boolean | null;
  checked_at: string | null;
  checked_by: string | null;
  checker_name?: string | null;
  order_index: number | null;
};

export default function ChecklistPage({
  type,
  title,
  defaults,
}: {
  type: "opening" | "closing";
  title: string;
  defaults: string[];
}) {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const today = format(new Date(), "yyyy-MM-dd");
  const [items, setItems] = useState<Item[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data } = await supabase
      .from("clinic_checklists")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("type", type)
      .eq("check_date", today)
      .order("order_index", { ascending: true });

    let rows = (data ?? []) as Item[];

    if (rows.length === 0) {
      // Seed defaults for today
      const seed = defaults.map((t, i) => ({
        clinic_id: clinicId,
        type,
        check_date: today,
        title: t,
        is_checked: false,
        order_index: i,
      }));
      const { data: inserted } = await supabase.from("clinic_checklists").insert(seed).select();
      rows = (inserted ?? []) as Item[];
    }

    // Resolve checker names
    const ids = Array.from(new Set(rows.map((r) => r.checked_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
      rows.forEach((r) => { r.checker_name = r.checked_by ? map.get(r.checked_by) ?? null : null; });
    }
    setItems(rows);
    setLoading(false);
  }, [clinicId, today, type, defaults]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (item: Item) => {
    const next = !item.is_checked;
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    const patch: any = {
      is_checked: next,
      checked_at: next ? new Date().toISOString() : null,
      checked_by: next ? userId : null,
    };
    const { error } = await supabase
      .from("clinic_checklists")
      .update(patch)
      .eq("id", item.id)
      .eq("check_date", today);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("clinic_checklists").delete().eq("id", id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const addItem = async () => {
    const t = newTitle.trim();
    if (!t || !clinicId) return;
    const { data, error } = await supabase.from("clinic_checklists").insert({
      clinic_id: clinicId,
      type,
      check_date: today,
      title: t,
      is_checked: false,
      order_index: items.length,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setItems((prev) => [...prev, data as Item]);
    setNewTitle("");
  };

  const resetAll = async () => {
    if (!clinicId) return;
    await supabase
      .from("clinic_checklists")
      .update({ is_checked: false, checked_at: null, checked_by: null })
      .eq("clinic_id", clinicId).eq("type", type).eq("check_date", today);
    load();
    toast.success("Checklist reset");
  };

  const done = items.filter((i) => i.is_checked).length;

  return (
    <DashboardLayout title={title}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-card">
          <div>
            <h1 className="font-display text-xl font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE, dd MMM yyyy")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={resetAll}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
            </Button>
          </div>
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
              <li className="py-6 text-center text-sm text-muted-foreground">No items</li>
            ) : items.map((it) => (
              <li key={it.id} className="flex items-start gap-3 py-3">
                <Checkbox checked={!!it.is_checked} onCheckedChange={() => toggle(it)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", it.is_checked && "line-through text-muted-foreground")}>{it.title}</p>
                  {it.is_checked && it.checked_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Checked by {it.checker_name ?? "—"} at {format(new Date(it.checked_at), "h:mm a")}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(it.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
              placeholder="Add a new item…"
            />
            <Button onClick={addItem}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
