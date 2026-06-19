import { useEffect, useState, useCallback } from "react";
import SettingsShell from "@/components/layout/SettingsShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

type Cat = {
  id: string;
  name: string;
  is_active: boolean | null;
  order_index: number | null;
};

export default function ExpenseCategoriesSettingsPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const [rows, setRows] = useState<Cat[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("expense_categories").select("*")
      .eq("clinic_id", clinicId)
      .order("order_index", { ascending: true });
    setRows((data ?? []) as Cat[]);
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const t = newName.trim();
    if (!t || !clinicId) return;
    const nextOrder = rows.length ? Math.max(...rows.map((r) => r.order_index ?? 0)) + 1 : 1;
    const { error } = await supabase.from("expense_categories").insert({
      clinic_id: clinicId, name: t, is_active: true, order_index: nextOrder,
    });
    if (error) { toast.error(error.message); return; }
    setNewName("");
    load();
  };

  const toggleActive = async (c: Cat) => {
    await supabase.from("expense_categories").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };

  const saveEdit = async (id: string) => {
    const t = editName.trim();
    if (!t) return;
    await supabase.from("expense_categories").update({ name: t }).eq("id", id);
    setEditingId(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    await supabase.from("expense_categories").delete().eq("id", id);
    load();
  };

  return (
    <SettingsShell title="Expense Categories">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="font-display text-xl font-semibold">Expense Categories</h1>
          <p className="text-sm text-muted-foreground">Manage the categories available when adding expenses</p>
        </div>

        <div className="rounded-2xl border bg-card shadow-card">
          <ul className="divide-y">
            {rows.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">No categories yet</li>
            ) : rows.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                {editingId === c.id ? (
                  <>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(c.id); }}
                      className="flex-1" autoFocus />
                    <Button size="icon" variant="ghost" onClick={() => saveEdit(c.id)}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{c.name}</span>
                    <Switch checked={!!c.is_active} onCheckedChange={() => toggleActive(c)} />
                    <Button size="icon" variant="ghost" onClick={() => { setEditingId(c.id); setEditName(c.name); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 border-t p-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              placeholder="Enter category name..." />
            <Button onClick={add}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>
          </div>
        </div>
      </div>
    </SettingsShell>
  );
}
