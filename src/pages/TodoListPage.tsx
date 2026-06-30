import { useEffect, useMemo, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useUrlState } from "@/hooks/useUrlState";
import { usePersistedForm } from "@/hooks/usePersistedForm";
import RestoreBanner from "@/components/RestoreBanner";
import { getProfileId } from "@/utils/getProfileId";

type Priority = "high" | "medium" | "low";

type Todo = {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  due_date: string | null;
  is_done: boolean | null;
  done_at: string | null;
  done_by: string | null;
  created_by: string | null;
  patient_id: string | null;
  doer_name?: string | null;
  creator_name?: string | null;
  patient_name?: string | null;
};

const PRIORITY_STYLES: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

export default function TodoListPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const [rows, setRows] = useState<Todo[]>([]);
  const [statusFilter, setStatusFilter] = useUrlState("filter", "all") as [
    "all" | "pending" | "done",
    (v: "all" | "pending" | "done") => void,
  ];
  const [priorityFilter, setPriorityFilter] = useUrlState("priority", "all") as [
    "all" | Priority,
    (v: "all" | Priority) => void,
  ];
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("todo_list")
      .select("*, patients(name)")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });
    const list = ((data ?? []) as any[]).map((r) => ({
      ...r,
      patient_name: Array.isArray(r.patients) ? r.patients[0]?.name : r.patients?.name ?? null,
    })) as Todo[];
    const ids = Array.from(new Set([...list.map((r) => r.created_by), ...list.map((r) => r.done_by)].filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
      list.forEach((r) => {
        r.creator_name = r.created_by ? map.get(r.created_by) ?? null : null;
        r.doer_name = r.done_by ? map.get(r.done_by) ?? null : null;
      });
    }
    setRows(list);
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter === "pending" && r.is_done) return false;
    if (statusFilter === "done" && !r.is_done) return false;
    if (priorityFilter !== "all" && (r.priority ?? "medium") !== priorityFilter) return false;
    return true;
  }), [rows, statusFilter, priorityFilter]);

  const today = new Date();
  const highPending = filtered.filter((r) => !r.is_done && (r.priority ?? "medium") === "high");
  const otherPending = filtered.filter((r) => !r.is_done && (r.priority ?? "medium") !== "high");
  const completedToday = filtered.filter((r) => r.is_done && r.done_at && isSameDay(parseISO(r.done_at), today));

  const toggle = async (t: Todo) => {
    const next = !t.is_done;
    const userId = await getAuthUserId();
    await supabase.from("todo_list").update({
      is_done: next,
      done_at: next ? new Date().toISOString() : null,
      done_by: next ? userId : null,
    }).eq("id", t.id);
    load();
  };

  return (
    <DashboardLayout title="To Do List">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-semibold mr-2">To Do List</h1>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" /> Add Task</Button>
        </div>

        <Section label="High Priority" color="text-red-600" items={highPending} onToggle={toggle} />
        <Section label="Medium & Low" color="text-amber-600" items={otherPending} onToggle={toggle} />
        <Section label="Completed Today" color="text-green-600" items={completedToday} onToggle={toggle} collapsible />
      </div>

      <TodoModal
        open={open}
        onClose={() => setOpen(false)}
        clinicId={clinicId ?? ""}
        onSaved={() => { setOpen(false); load(); }}
      />
    </DashboardLayout>
  );
}

function Section({
  label, color, items, onToggle, collapsible,
}: {
  label: string; color: string; items: Todo[]; onToggle: (t: Todo) => void; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card">
      <button onClick={() => setOpen((o) => !o)} className="mb-3 flex w-full items-center justify-between">
        <h2 className={cn("font-display text-base font-semibold", color)}>{label} <span className="text-xs text-muted-foreground">({items.length})</span></h2>
        {collapsible && <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>}
      </button>
      {open && (
        items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nothing here</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((t) => {
              const p = (t.priority ?? "medium") as Priority;
              const overdue = t.due_date && t.due_date < today && !t.is_done;
              const dueToday = t.due_date === today && !t.is_done;
              return (
                <div key={t.id} className="flex gap-3 rounded-xl border bg-background p-3">
                  <Checkbox checked={!!t.is_done} onCheckedChange={() => onToggle(t)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[10px] capitalize", PRIORITY_STYLES[p])}>{p}</Badge>
                      <p className={cn("text-sm font-semibold truncate", t.is_done && "line-through text-muted-foreground")}>{t.title}</p>
                    </div>
                    {t.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {t.patient_id && t.patient_name && (
                        <a
                          href={`/patients/${t.patient_id}`}
                          className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.patient_name}
                        </a>
                      )}
                      {t.due_date && (
                        <span className={cn(overdue && "text-red-600 font-medium", dueToday && "text-amber-600 font-medium")}>
                          Due {t.due_date}
                        </span>
                      )}
                      {t.creator_name && <span>· by {t.creator_name}</span>}
                      {t.is_done && t.done_at && (
                        <span>· Done by {t.doer_name ?? "—"} at {format(parseISO(t.done_at), "h:mm a")}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function TodoModal({
  open, onClose, clinicId, onSaved,
}: {
  open: boolean; onClose: () => void; clinicId: string; onSaved: () => void;
}) {

  const DEFAULTS = { title: "", description: "", priority: "medium" as Priority, dueDate: "" };
  const { values, updateField, clearSaved, hasSaved, dismissBanner } = usePersistedForm(
    "add_todo",
    DEFAULTS,
    { enabled: open }
  );
  const { title, description, priority, dueDate } = values;
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    setBusy(true);
    const userId = await getAuthUserId();
    const { error } = await supabase.from("todo_list").insert({
      clinic_id: clinicId,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      due_date: dueDate || null,
      created_by: userId,
      is_done: false,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    clearSaved();
    toast.success("Task added");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
        <RestoreBanner visible={hasSaved} onContinue={dismissBanner} onDiscard={clearSaved} />
        <div className="grid gap-3">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => updateField("title", e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => updateField("description", e.target.value)} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => updateField("priority", v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => updateField("dueDate", e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
