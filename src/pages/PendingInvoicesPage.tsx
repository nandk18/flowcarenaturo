import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainShell from "@/components/layout/MainShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Inv = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  outstanding_amount: number;
  paid_amount: number;
  status: string;
  patients: { id: string; name: string } | null;
};

export default function PendingInvoicesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const clinicId = profile?.clinic_id;
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [allOpen, setAllOpen] = useState(false);
  const [rows, setRows] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let q = supabase
          .from("invoices")
          .select("id, invoice_number, invoice_date, total_amount, outstanding_amount, paid_amount, status, patients(id, name)")
          .eq("clinic_id", clinicId)
          .in("status", ["unpaid", "partially_paid"])
          .order("invoice_date", { ascending: false });
        if (!allOpen) q = q.eq("invoice_date", date);
        const { data, error } = await q;
        if (error) throw error;
        if (!cancelled) {
          setRows(
            (data ?? []).map((r: any) => ({
              ...r,
              patients: Array.isArray(r.patients) ? r.patients[0] : r.patients,
            })),
          );
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load");
          toast.error(e?.message || "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clinicId, date, allOpen]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + Number(r.outstanding_amount || 0), 0),
    [rows],
  );

  return (
    <MainShell title="Pending Invoices">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Invoice date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={allOpen}
            className="w-44"
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch checked={allOpen} onCheckedChange={setAllOpen} id="all-open" />
          <Label htmlFor="all-open" className="text-sm">Show all open</Label>
        </div>
        <div className="ml-auto text-sm">
          <span className="text-muted-foreground">Total pending:</span>{" "}
          <span className="font-semibold text-destructive">₹{total.toLocaleString("en-IN")}</span>
        </div>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-destructive py-8">
                    {error}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No pending invoices for this date
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => r.patients?.id ? navigate(`/patients/${r.patients.id}?tab=invoices`)}
                  >
                    <TableCell className="font-medium">{r.patients?.name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                    <TableCell className="text-sm">{r.invoice_date}</TableCell>
                    <TableCell className="text-right">₹{Number(r.total_amount).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right text-destructive font-semibold">
                      ₹{Number(r.outstanding_amount).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{r.status.replace("_", " ")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </MainShell>
  );
}
