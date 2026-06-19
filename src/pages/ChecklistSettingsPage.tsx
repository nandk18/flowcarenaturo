import { useEffect, useState, useCallback } from "react";
import SettingsShell from "@/components/layout/SettingsShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

type Item = {
  id: string;
  title: string;
  is_active: boolean | null;
  order_index: number | null;
};

export default function ChecklistSettingsPage({
  type,
  title,
  subtitle,
}: {
  type: "opening" | "closing";
  title: string;
  subtitle: string;
}) {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const [items, setItems] = useState<Item[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const load = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("type", type)
      .order("order_index", { ascending: true });
    setItems((data ?? []) as Item[]);
  }, [clinicId, type]);

  useEffect(() => { load(); }, [load]);

  const addItem = async () => {
    const t = newTitle.trim();
    if (!t || !clinicId) return;
    const nextOrder = items.length ? Math.max(...items.map((i) => i.order_index ?? 0)) + 1 : 1;
    const { error } = await supabase.from("checklist_items").insert({
      clinic_id: clinicId, type, title: t, is_active: true, order_index: nextOrder,
    });
    if (error) { toast.error(error.message); return; }
    setNewTitle("");
    load();
  };

  const toggleActive = async (it: Item) => {
    await supabase.from("checklist_items").update({ is_active: !it.is_active }).eq("id", it.id);
    load();
  };

  const saveEdit = async (id: string) => {
    const t = editTitle.trim();
    if (!t) return;
    await supabase.from("checklist_items").update({ title: t }).eq("id", id);
    setEditingId(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this checklist item?")) return;
    await supabase.from("checklist_items").delete().eq("id", id);
    load();
  };

  return (
    <SettingsShell title={title}>
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="font-display text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="rounded-2xl border bg-card shadow-card">
          <ul className="divide-y">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">No items yet</li>
            ) : items.map((it, idx) => (
              <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-xs text-muted-foreground">{idx + 1}.</span>
                {editingId === it.id ? (
                  <>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(it.id); }}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={() => saveEdit(it.id)}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{it.title}</span>
                    <Switch checked={!!it.is_active} onCheckedChange={() => toggleActive(it)} />
                    <Button size="icon" variant="ghost" onClick={() => { setEditingId(it.id); setEditTitle(it.title); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(it.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 border-t p-3">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
              placeholder="Enter checklist item..."
            />
            <Button onClick={addItem}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>
          </div>
        </div>
      </div>
    </SettingsShell>
  );
}
