import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SettingsShell from "@/components/layout/SettingsShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet, ArrowRight } from "lucide-react";

type Row = {
  clinic_id: string;
  petty_cash_balance: number | null;
  petty_cash_limit: number | null;
};

export default function PettyCashSettingsPage() {
  const { profile } = useAuth();
  const clinicId = profile?.clinic_id;
  const [row, setRow] = useState<Row | null>(null);
  const [limit, setLimit] = useState("0");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("clinic_financial_settings")
      .select("clinic_id,petty_cash_balance,petty_cash_limit")
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (!data) {
      await supabase.from("clinic_financial_settings").insert({
        clinic_id: clinicId,
        petty_cash_balance: 0,
        petty_cash_limit: 0,
      });
      setRow({ clinic_id: clinicId, petty_cash_balance: 0, petty_cash_limit: 0 });
      setLimit("0");
    } else {
      setRow(data as Row);
      setLimit(String(data.petty_cash_limit ?? 0));
    }
  };

  useEffect(() => { load(); }, [clinicId]);

  const saveLimit = async () => {
    if (!clinicId) return;
    setBusy(true);
    const { error } = await supabase
      .from("clinic_financial_settings")
      .update({ petty_cash_limit: Number(limit) || 0 })
      .eq("clinic_id", clinicId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Limit saved");
    load();
  };

  const balance = Number(row?.petty_cash_balance ?? 0);
  const lim = Number(row?.petty_cash_limit ?? 0);
  const overLimit = lim > 0 && balance > lim;

  return (
    <SettingsShell title="Petty Cash">
      <div className="space-y-5 max-w-2xl">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-base font-semibold">Current Balance</h2>
              <p className="text-xs text-muted-foreground">Cash on hand at the clinic</p>
            </div>
          </div>
          <div className={`text-4xl font-bold ${overLimit ? "text-destructive" : "text-foreground"}`}>
            ₹{balance.toLocaleString("en-IN")}
          </div>
          {lim > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Limit: ₹{lim.toLocaleString("en-IN")} {overLimit && <span className="text-destructive font-medium">(over limit)</span>}
            </p>
          )}
          <Link to="/tasks/expense-list">
            <Button variant="outline" size="sm" className="mt-4">
              Top up / Withdraw in Expenses <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Petty cash top-ups and withdrawals are now managed from the Front Desk → Expenses page.
          </p>
        </Card>

        <Card className="p-6 space-y-3">
          <h3 className="font-semibold text-sm">Maximum Limit</h3>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>Limit (₹) — 0 disables alerts</Label>
              <Input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} />
            </div>
            <Button onClick={saveLimit} disabled={busy}>Save</Button>
          </div>
        </Card>
      </div>
    </SettingsShell>
  );
}
