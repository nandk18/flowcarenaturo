import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { getProfileId } from "@/utils/getProfileId";

type Priority = "high" | "medium" | "low";

type Todo = {
  id: string;
  title: string;
  priority: string | null;
  due_date: string | null;
  is_done: boolean | null;
  done_at: string | null;
};

const PRIO: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

export default function PatientTodoCard({ patientId, clinicId }: { patientId: string; clinicId: string }) {
  const [rows, setRows] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("todo_list")
      .select("id, title, priority, due_date, is_done, done_at")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("is_done", { ascending: true })
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Todo[]);
  };

  useEffect(() => { load(); }, [patientId, clinicId]);

  const add = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    setBusy(true);
    const userId = await getProfileId();
    const { error } = await (supabase as any).from("todo_list").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      title: title.trim(),
      priority,
      due_date: dueDate || null,
      is_done: false,
      created_by: userId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setTitle(""); setDueDate(""); setPriority("medium");
    toast.success("Task added");
    load();
  };

  const toggle = async (t: Todo) => {
    const next = !t.is_done;
    const userId = await getProfileId();
    await (supabase as any).from("todo_list").update({
      is_done: next,
      done_at: next ? new Date().toISOString() : null,
      done_by: next ? userId : null,
    }).eq("id", t.id);
    load();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <CheckSquare className="h-4 w-4" /> Patient Tasks
        {rows.length > 0 && <span className="text-xs text-muted-foreground">({rows.filter((r) => !r.is_done).length} open)</span>}
      </h2>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_120px_140px_auto]">
        <Input
          placeholder="Add task for this patient..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        />
        <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <Button onClick={add} disabled={busy || !title.trim()}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No tasks for this patient yet</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => {
            const p = (t.priority ?? "medium") as Priority;
            const overdue = t.due_date && t.due_date < today && !t.is_done;
            return (
              <li key={t.id} className="flex items-start gap-3 rounded-lg border bg-background p-3">
                <Checkbox checked={!!t.is_done} onCheckedChange={() => toggle(t)} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px] capitalize", PRIO[p])}>{p}</Badge>
                    <p className={cn("text-sm font-medium", t.is_done && "text-muted-foreground line-through")}>{t.title}</p>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {t.due_date && <span className={cn(overdue && "text-red-600 font-medium")}>Due {t.due_date}</span>}
                    {t.is_done && t.done_at && <span>· Done {format(parseISO(t.done_at), "dd MMM h:mm a")}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
