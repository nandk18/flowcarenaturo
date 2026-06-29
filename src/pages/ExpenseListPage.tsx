import { useEffect, useMemo, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Download, Wallet, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { Link } from "react-router-dom";
import { useUrlState } from "@/hooks/useUrlState";
import { usePersistedForm } from "@/hooks/usePersistedForm";
import RestoreBanner from "@/components/RestoreBanner";
import { getProfileId } from "@/utils/getProfileId";

type Expense = {
  id: string;
  title: string;
  category: string | null;
  amount: number | null;
  expense_date: string | null;
  notes: string | null;
  payment_type: string | null;
  created_by: string | null;
  creator_name?: string | null;
};

type Category = { id: string; name: string; is_active: boolean | null };

type RangeKey = "today" | "week" | "month" | "custom";

export default function ExpenseListPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const [rows, setRows] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const today0 = format(new Date(), "yyyy-MM-dd");
  const [range, setRange] = useUrlState("period", "today") as [RangeKey, (v: RangeKey) => void];
  const [from, setFrom] = useUrlState("from", today0);
  const [to, setTo] = useUrlState("to", today0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const computeRange = useCallback(() => {
    const today = new Date();
    if (range === "today") return { f: format(today, "yyyy-MM-dd"), t: format(today, "yyyy-MM-dd") };
    if (range === "week") return { f: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"), t: format(today, "yyyy-MM-dd") };
    if (range === "month") return { f: format(startOfMonth(today), "yyyy-MM-dd"), t: format(today, "yyyy-MM-dd") };
    return { f: from, t: to };
  }, [range, from, to]);

  const loadCategories = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("expense_categories")
      .select("id, name, is_active")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("order_index", { ascending: true });
    setCategories((data ?? []) as Category[]);
  }, [clinicId]);

  const load = useCallback(async () => {
    if (!clinicId) return;
    const { f, t } = computeRange();
    const { data } = await supabase
      .from("expense_list")
      .select("*")
      .eq("clinic_id", clinicId)
      .gte("expense_date", f)
      .lte("expense_date", t)
      .order("expense_date", { ascending: false });
    const list = (data ?? []) as Expense[];
    const ids = Array.from(new Set(list.map((r) => r.created_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
      list.forEach((r) => { r.creator_name = r.created_by ? map.get(r.created_by) ?? null : null; });
    }
    setRows(list);
  }, [clinicId, computeRange]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => { const k = r.category || "Miscellaneous"; map[k] = (map[k] || 0) + (Number(r.amount) || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const byPayment = useMemo(() => {
    const cash = rows.filter((r) => (r.payment_type ?? "cash") === "cash").reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const upi = rows.filter((r) => r.payment_type === "upi").reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const petty = rows.filter((r) => r.payment_type === "petty_cash").reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return { cash, upi, petty };
  }, [rows]);

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const row = rows.find((r) => r.id === id);
    await supabase.from("expense_list").delete().eq("id", id);
    if (row && row.payment_type === "petty_cash" && clinicId) {
      // refund balance
      await supabase.rpc("adjust_petty_cash", { p_clinic_id: clinicId, p_delta: Number(row.amount) || 0 });
    }
    load();
  };

  const exportCsv = () => {
    const headers = ["Date", "Title", "Category", "Payment", "Amount", "Notes", "Added by"];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      lines.push([r.expense_date, JSON.stringify(r.title), r.category ?? "", r.payment_type ?? "", r.amount ?? 0, JSON.stringify(r.notes ?? ""), JSON.stringify(r.creator_name ?? "")].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `expenses_${format(new Date(), "yyyyMMdd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Expense List">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-semibold mr-2">Expense List</h1>
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {range === "custom" && (
              <>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[140px]" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[140px]" />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right text-sm">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-display text-lg font-bold">₹{total.toFixed(2)}</div>
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-1 h-3.5 w-3.5" /> CSV</Button>
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Expense
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="text-xs text-muted-foreground">By Payment Type</div>
            <div className="mt-1 flex gap-4 text-sm flex-wrap">
              <span>Cash: <b>₹{byPayment.cash.toFixed(2)}</b></span>
              <span>UPI: <b>₹{byPayment.upi.toFixed(2)}</b></span>
              <span>Petty Cash: <b>₹{byPayment.petty.toFixed(2)}</b></span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount (₹)</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Added by</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No expenses</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.expense_date}</TableCell>
                  <TableCell className="text-sm font-medium">{r.title}</TableCell>
                  <TableCell className="text-sm">{r.category ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={r.payment_type === "upi" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-green-50 text-green-700 border-green-200"}>
                      {(r.payment_type ?? "cash").toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">₹{Number(r.amount ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">{r.notes ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.creator_name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {byCategory.length > 0 && (
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-display text-base font-semibold">Summary by category</h2>
            <ul className="space-y-2">
              {byCategory.map(([cat, amt]) => {
                const pct = total ? (amt / total) * 100 : 0;
                return (
                  <li key={cat}>
                    <div className="flex justify-between text-sm">
                      <span>{cat}</span>
                      <span className="font-medium">₹{amt.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <ExpenseModal
        open={open}
        onClose={() => setOpen(false)}
        initial={editing}
        clinicId={clinicId ?? ""}
        categories={categories}
        onSaved={() => { setOpen(false); load(); }}
      />
    </DashboardLayout>
  );
}

function ExpenseModal({
  open, onClose, initial, clinicId, categories, onSaved,
}: {
  open: boolean; onClose: () => void; initial: Expense | null;
  clinicId: string; categories: Category[]; onSaved: () => void;
}) {
  const DEFAULTS = {
    title: "",
    category: "",
    paymentType: "cash" as "cash" | "upi" | "petty_cash",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  };
  const persistKey = initial ? `edit_expense_${initial.id}` : "add_expense";
  const { values, updateField, setValues, clearSaved, hasSaved, dismissBanner } = usePersistedForm(
    persistKey,
    DEFAULTS,
    { enabled: open }
  );
  const { title, category, paymentType, amount, date, notes } = values;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && initial) {
      setValues({
        title: initial.title ?? "",
        category: initial.category ?? (categories[0]?.name ?? ""),
        paymentType: (initial.payment_type as any) ?? "cash",
        amount: initial.amount != null ? String(initial.amount) : "",
        date: initial.expense_date ?? format(new Date(), "yyyy-MM-dd"),
        notes: initial.notes ?? "",
      });
    } else if (open && !initial && !category && categories[0]) {
      updateField("category", categories[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, categories]);

  const save = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    if (!amount || isNaN(Number(amount))) { toast.error("Amount required"); return; }
    if (!category) { toast.error("Category required"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    const newAmount = Number(amount);
    const payload = {
      clinic_id: clinicId,
      title: title.trim(),
      category,
      payment_type: paymentType,
      amount: newAmount,
      expense_date: date,
      notes: notes.trim() || null,
      created_by: userId,
    };
    const res = initial
      ? await supabase.from("expense_list").update(payload).eq("id", initial.id)
      : await supabase.from("expense_list").insert(payload);
    if (!res.error) {
      // Adjust petty cash balance: refund previous if it was petty_cash, then deduct new
      const prevPetty = initial?.payment_type === "petty_cash" ? Number(initial.amount) || 0 : 0;
      const nextPetty = paymentType === "petty_cash" ? newAmount : 0;
      const delta = prevPetty - nextPetty;
      if (delta !== 0) {
        await supabase.rpc("adjust_petty_cash", { p_clinic_id: clinicId, p_delta: delta });
      }
    }
    setBusy(false);
    if (res.error) { toast.error(res.error.message); return; }
    clearSaved();
    toast.success(initial ? "Expense updated" : "Expense added");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
        {!initial && <RestoreBanner visible={hasSaved} onContinue={dismissBanner} onDiscard={clearSaved} />}
        <div className="grid gap-3">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => updateField("title", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category *</Label>
              {categories.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  No categories. <Link to="/settings/expense-categories" className="text-primary hover:underline">Configure categories in Settings</Link>
                </p>
              ) : (
                <Select value={category} onValueChange={(v) => updateField("category", v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Payment Type *</Label>
              <Select value={paymentType} onValueChange={(v) => updateField("paymentType", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="petty_cash">Petty Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount (₹) *</Label><Input type="number" step="0.01" value={amount} onChange={(e) => updateField("amount", e.target.value)} /></div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => updateField("date", e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => updateField("notes", e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
